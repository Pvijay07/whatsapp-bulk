import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { processSingleMessage } from './messaging.worker';

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 3) return null; // stop reconnecting if Redis is not running locally
    return Math.min(times * 1000, 3000);
  },
});

redisConnection.on('error', (err) => {
  // Silent fallback when running locally without standalone Redis
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
  try {
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
  } catch (err: any) {
    // If BullMQ/Redis is unavailable, fallback to resilient asynchronous in-process dispatch
    for (const msgId of messageIds) {
      setImmediate(async () => {
        try {
          await processSingleMessage(campaignId, msgId, organizationId);
        } catch (e) {}
      });
    }
  }
}

