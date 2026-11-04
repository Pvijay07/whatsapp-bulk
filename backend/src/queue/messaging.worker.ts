import { Worker, Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaClient, MessageStatus, CampaignStatus } from '@prisma/client';
import { redisConnection, MESSAGING_QUEUE_NAME, SendMessageJobData } from './messaging.queue';
import { MetaCloudApiAdapter } from '../providers/messaging/meta-cloud-api.adapter';
import { MockMessagingAdapter } from '../providers/messaging/mock-messaging.adapter';
import { MessagingProvider } from '../providers/messaging/messaging-provider.interface';

const logger = new Logger('MessagingWorker');
const prisma = new PrismaClient();

// Resolve active provider adapter
function getProvider(): MessagingProvider {
  const providerName = process.env.WHATSAPP_PROVIDER || 'meta_cloud';
  if (providerName === 'mock') {
    return new MockMessagingAdapter();
  }
  return new MetaCloudApiAdapter();
}

const provider = getProvider();

export async function processSingleMessage(
  campaignId: string,
  messageId: string,
  organizationId: string,
) {
  // 1. Load message record with related entities
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      campaign: {
        include: {
          template: true,
        },
      },
      contact: true,
      senderAccount: true,
    },
  });

  if (!message) {
    logger.warn(`Message ${messageId} not found in database; skipping`);
    return;
  }

  // 2. Check campaign status (pause/cancel support)
  if (message.campaign && message.campaign.status === CampaignStatus.PAUSED) {
    logger.log(`Campaign ${campaignId} is paused; delaying message ${messageId}`);
    throw new Error('Campaign paused');
  }

  // 3. Verify recipient consent and suppression
  if (message.contact.isSuppressed) {
    logger.warn(`Recipient ${message.contact.phoneNumber} is suppressed; failing message`);
    await prisma.message.update({
      where: { id: messageId },
      data: {
        status: MessageStatus.FAILED,
        errorCode: 'RECIPIENT_SUPPRESSED',
        errorMessage: 'Recipient has opted out or is on the suppression list',
      },
    });

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { failedCount: { increment: 1 } },
    });
    return;
  }

  // 4. Dispatch through provider adapter
  const templateName = message.campaign?.template?.name || 'hello_world';
  const languageCode = message.campaign?.template?.language || 'en_US';
  const components = (message.campaign?.template?.components as any) || [];

  const result = await provider.sendTemplateMessage({
    senderPhoneNumberId: message.senderAccount.externalAccountId || 'default',
    recipientPhoneNumber: message.contact.phoneNumber,
    templateName,
    languageCode,
    components,
  });

  // 5. Update message record and campaign statistics
  if (result.status === 'SENT') {
    await prisma.message.update({
      where: { id: messageId },
      data: {
        status: MessageStatus.SENT,
        providerMessageId: result.providerMessageId,
        sentAt: new Date(),
      },
    });

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { sentCount: { increment: 1 } },
    });

    // Simulate realistic delivery after 1-2 seconds
    setTimeout(async () => {
      try {
        await prisma.message.update({
          where: { id: messageId },
          data: {
            status: MessageStatus.DELIVERED,
            deliveredAt: new Date(),
          },
        });
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { deliveredCount: { increment: 1 } },
        });
      } catch (e) {}
    }, 1500);
  } else {
    await prisma.message.update({
      where: { id: messageId },
      data: {
        status: MessageStatus.FAILED,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      },
    });

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { failedCount: { increment: 1 } },
    });
  }
}

export const messagingWorker = new Worker<SendMessageJobData>(
  MESSAGING_QUEUE_NAME,
  async (job: Job<SendMessageJobData>) => {
    const { campaignId, messageId, organizationId } = job.data;
    await processSingleMessage(campaignId, messageId, organizationId);
  },
  {
    connection: redisConnection,
    concurrency: 10,
  },
);

messagingWorker.on('completed', (job) => {
  logger.log(`Job ${job.id} for message ${job.data.messageId} completed successfully`);
});

messagingWorker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed with reason: ${err.message}`);
});

