import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const MESSAGING_QUEUE_NAME = 'whatsapp-messaging';

export const messagingQueue = new Queue(MESSAGING_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export interface SendMessageJobData {
  campaignId: string;
  messageId: string;
  organizationId: string;
}

/**
 * Enqueues a batch of messages for asynchronous campaign dispatching
 */
export async function enqueueCampaignMessages(
  campaignId: string,
  organizationId: string,
  messageIds: string[],
) {
  const jobs = messageIds.map((id) => ({
    name: 'send-message',
    data: {
      campaignId,
      messageId: id,
      organizationId,
    } as SendMessageJobData,
    opts: {
      jobId: `msg_${id}`,
    },
  }));

  await messagingQueue.addBulk(jobs);
}

