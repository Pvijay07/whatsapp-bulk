const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const {
  SalesBusterFollowupsService,
  formatWhatsAppReplyText,
} = require('../../../dist/src/modules/salesbuster-followups/salesbuster-followups.service');

function createHarness(options = {}) {
  const states = new Map();
  const reports = [];
  const sentMessages = [];

  const mockPrisma = {
    leadFollowupState: {
      findUnique: async ({ where }) => {
        const k = `${where.tenantDbName_mongoLeadId_stage.tenantDbName}:${where.tenantDbName_mongoLeadId_stage.mongoLeadId}:${where.tenantDbName_mongoLeadId_stage.stage}`;
        return states.get(k) || null;
      },
      upsert: async ({ where, create, update }) => {
        const k = `${where.tenantDbName_mongoLeadId_stage.tenantDbName}:${where.tenantDbName_mongoLeadId_stage.mongoLeadId}:${where.tenantDbName_mongoLeadId_stage.stage}`;
        const prev = states.get(k);
        const next = prev ? { ...prev, ...update } : { id: k, ...create };
        states.set(k, next);
        return next;
      },
    },
    followupDispatchReport: {
      create: async ({ data }) => {
        reports.push(data);
        return data;
      },
    },
  };

  const mockMongo = {
    isConfigured: () => true,
    fetchRecentLeadMessages: async () =>
      options.recentMessages || [
        { direction: 'incoming', sender: 'Client', text: 'Do you offer dog grooming?' },
        { direction: 'outgoing', sender: 'AI Agent', text: 'Yes! We offer full-service grooming.' },
      ],
  };

  const mockBaileys = {
    sendRealMessage: async (phone, text) => {
      if (options.failSend) {
        return { success: false, messageId: '', error: 'No online WhatsApp account available.' };
      }
      sentMessages.push({ phone, text });
      return { success: true, messageId: `baileys_${sentMessages.length}`, senderNumber: '919000000000' };
    },
  };

  const service = new SalesBusterFollowupsService(mockPrisma, mockMongo, mockBaileys);
  return { service, states, reports, sentMessages };
}

test('resolveLeadStage maps all 5 SalesBuster stages accurately', () => {
  const { service } = createHarness();
  const now = new Date('2026-11-27T12:00:00Z');

  assert.equal(service.resolveLeadStage({ _id: '1', phone: '919876543210', status: 'New', folder: 'New Leads' }, now), 'new_lead');
  assert.equal(service.resolveLeadStage({ _id: '2', phone: '919876543210', folder: 'Not Attended' }, now), 'not_attended');
  assert.equal(service.resolveLeadStage({ _id: '3', phone: '919876543210', folder: 'Not Responding' }, now), 'not_responding');
  assert.equal(service.resolveLeadStage({ _id: '4', phone: '919876543210', folder: 'Future Leads' }, now), 'marketing_drip');
  assert.equal(service.resolveLeadStage({ _id: '5', phone: '919876543210', status: 'Follow Up', nextFollowUp: '2026-11-27' }, now), 'followup');
  assert.equal(service.resolveLeadStage({ _id: '6', phone: '919876543210', status: 'Follow Up', nextFollowUp: '2026-12-10' }, now), null);
});

test('New Lead & Not Attended & Scheduled Followup each dispatch once and mark COMPLETED', async () => {
  const { service, states, reports, sentMessages } = createHarness();
  const now = new Date('2026-11-27T10:00:00Z');
  const org = { _id: 'org1', name: 'Petsfolio', tenantDbName: 'sb_tenant_1' };

  const newLead = { _id: 'l_new', name: 'Aarav', phone: '919876543210', service: 'Pet Boarding', status: 'New', folder: 'New Leads' };
  const notAttended = { _id: 'l_na', name: 'Diya', phone: '919876543211', service: 'Grooming', folder: 'Not Attended' };
  const followupLead = { _id: 'l_fu', name: 'Kabir', phone: '919876543212', service: 'Training', status: 'Follow Up', nextFollowUp: '2026-11-27' };

  assert.equal(await service.processSingleLead(newLead, org, now), 'SENT');
  assert.equal(await service.processSingleLead(newLead, org, now), 'SKIPPED'); // second run skips
  assert.equal(await service.processSingleLead(notAttended, org, now), 'SENT');
  assert.equal(await service.processSingleLead(followupLead, org, now), 'SENT');

  assert.equal(sentMessages.length, 3);
  assert.equal(reports.length, 3);
  assert.equal(states.get('sb_tenant_1:l_new:new_lead').status, 'COMPLETED');
  assert.equal(states.get('sb_tenant_1:l_na:not_attended').status, 'COMPLETED');
  assert.equal(states.get('sb_tenant_1:l_fu:followup').status, 'COMPLETED');
});

test('Not Responding sends 5 followups then marks COMPLETED in Postgres', async () => {
  const { service, states, reports, sentMessages } = createHarness();
  const org = { _id: 'org1', name: 'Petsfolio', tenantDbName: 'sb_tenant_1', workflowSettings: { notRespondingMaxFollowups: 5 } };
  const lead = { _id: 'lead_nr_1', name: 'Riya', phone: '919876543210', service: 'Grooming', folder: 'Not Responding' };

  const res1 = await service.processSingleLead(lead, org, new Date('2026-11-27T10:00:00Z'));
  assert.equal(res1, 'SENT');
  assert.equal(sentMessages.length, 1);
  assert.equal(reports[0].stage, 'not_responding');
  assert.equal(reports[0].attemptNumber, 1);

  const state = states.get('sb_tenant_1:lead_nr_1:not_responding');
  assert.equal(state.attemptCount, 1);
  assert.equal(state.status, 'ACTIVE');

  // Re-running before nextDueAt should skip
  assert.equal(await service.processSingleLead(lead, org, new Date('2026-11-27T11:00:00Z')), 'SKIPPED');

  // Simulate 5th attempt
  state.attemptCount = 4;
  state.nextDueAt = new Date('2026-11-27T09:00:00Z');
  const res5 = await service.processSingleLead(lead, org, new Date('2026-11-27T12:00:00Z'));
  assert.equal(res5, 'SENT');
  const finalState = states.get('sb_tenant_1:lead_nr_1:not_responding');
  assert.equal(finalState.attemptCount, 5);
  assert.equal(finalState.status, 'COMPLETED');
});

test('Future Leads sends 15-day marketing message and reschedules +15 days', async () => {
  const { service, states, reports } = createHarness();
  const now = new Date('2026-11-27T10:00:00Z');
  const org = { _id: 'org1', name: 'Petsfolio', tenantDbName: 'sb_tenant_1', workflowSettings: { futureLeadsDripIntervalDays: 15 } };
  const lead = { _id: 'lead_fl_1', name: 'Arjun', phone: '919811223344', service: 'Boarding', folder: 'Future Leads' };

  const res = await service.processSingleLead(lead, org, now);
  assert.equal(res, 'SENT');
  assert.equal(reports[0].stage, 'marketing_drip');

  const state = states.get('sb_tenant_1:lead_fl_1:marketing_drip');
  assert.equal(state.status, 'ACTIVE');
  const diffDays = (state.nextDueAt.getTime() - now.getTime()) / (24 * 3600 * 1000);
  assert.equal(Math.round(diffDays), 15);
});

test('AI Auto Followup uses Qdrant KB, aiSettings, chat history, and WhatsApp formatting', async () => {
  const originalPost = axios.post;
  const origGemini = process.env.GEMINI_API_KEY;
  const origCluster = process.env.CLUSTER_ENDPOINT;
  const origQdrantKey = process.env.QDRANT_API_KEY;

  process.env.GEMINI_API_KEY = 'test_gemini_key';
  process.env.CLUSTER_ENDPOINT = 'https://qdrant.test.local';
  process.env.QDRANT_API_KEY = 'test_qdrant_key';

  let capturedGeminiPrompt = '';
  let qdrantCalled = false;

  axios.post = async (url, body) => {
    if (url.includes('embedContent')) {
      return { data: { embedding: { values: [0.1, 0.2, 0.3] } } };
    }
    if (url.includes('points/search')) {
      qdrantCalled = true;
      return {
        data: {
          result: [
            { payload: { pageContent: 'Petsfolio Grooming includes bath, nail trim, and coat styling starting at Rs. 799.' } },
          ],
        },
      };
    }
    if (url.includes('generateContent')) {
      capturedGeminiPrompt = body.contents[0].parts[0].text;
      return {
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Hi Riya! Here is what we include: 1. Full bath & blow dry 2. Nail trim & styling Would you like to book?',
                  },
                ],
              },
            },
          ],
        },
      };
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  try {
    const { service } = createHarness();
    service.config.mode = 'AI_PLUS_TEMPLATE';
    const org = {
      _id: 'org_kb_1',
      name: 'Petsfolio',
      tenantDbName: 'sb_tenant_1',
      aiSettings: {
        companyName: 'Petsfolio',
        businessDescription: 'Premium pet care and grooming studio.',
        agentPersona: 'warm pet care advisor',
        customInstructions: 'Always mention *doorstep service* and keep it under 50 words.',
        qdrantCollection: 'org_petsfolio_kb',
        services: [{ name: 'Pet Grooming', description: 'Bath, haircut & nail trim' }],
      },
    };
    const lead = { _id: 'lead_kb_1', name: 'Riya', phone: '919876543210', service: 'Pet Grooming' };

    const msg = await service.generateStageMessage(lead, org, 'followup', 1);

    assert.equal(qdrantCalled, true);
    assert.match(capturedGeminiPrompt, /Premium pet care and grooming studio/);
    assert.match(capturedGeminiPrompt, /Pet Grooming: Bath, haircut & nail trim/);
    assert.match(capturedGeminiPrompt, /Rs\. 799/);
    assert.match(capturedGeminiPrompt, /Do you offer dog grooming\?/);
    assert.match(capturedGeminiPrompt, /Always mention \*doorstep service\*/);
    assert.match(msg, /1\. Full bath & blow dry\n2\. Nail trim & styling/);
  } finally {
    axios.post = originalPost;
    process.env.GEMINI_API_KEY = origGemini;
    process.env.CLUSTER_ENDPOINT = origCluster;
    process.env.QDRANT_API_KEY = origQdrantKey;
  }
});

test('Failed Baileys send logs FAILED report in Postgres and retries in 1h without incrementing attemptCount', async () => {
  const { service, states, reports } = createHarness({ failSend: true });
  const now = new Date('2026-11-27T10:00:00Z');
  const org = { _id: 'org1', name: 'Petsfolio', tenantDbName: 'sb_tenant_1' };
  const lead = { _id: 'l_fail', name: 'Sam', phone: '919876543210', folder: 'Not Responding' };

  const res = await service.processSingleLead(lead, org, now);
  assert.equal(res, 'FAILED');
  assert.equal(reports[0].deliveryStatus, 'FAILED');
  assert.match(reports[0].errorMessage, /No online WhatsApp account/);

  const state = states.get('sb_tenant_1:l_fail:not_responding');
  assert.equal(state.attemptCount, 0);
  assert.equal(state.status, 'ACTIVE');
  assert.equal(state.nextDueAt.getTime() - now.getTime(), 3600 * 1000);
});

test('formatWhatsAppReplyText formats inline lists cleanly onto separate lines', () => {
  const raw = 'Options: 1. Grooming. 2. Boarding. Would you like one?';
  const out = formatWhatsAppReplyText(raw);
  assert.equal(out, 'Options:\n1. Grooming.\n2. Boarding.\n\nWould you like one?');
});
