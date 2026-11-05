import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { MESSAGING_QUEUE_NAME, SendMessageJobData } from './messaging.constants';

export { MESSAGING_QUEUE_NAME, SendMessageJobData };

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 3) return null; // stop reconnecting if Redis is not running locally
    return Math.min(times * 1000, 3000);
  },
});

redisConnection.on('error', (_err) => {
  // Silent fallback when running locally without standalone Redis
});

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

messagingQueue.on('error', (_err) => {
  // Silent fallback if Redis is unavailable
});

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
    try {
      const { processSingleMessage } = await import('./messaging.worker');
      for (const msgId of messageIds) {
        setImmediate(async () => {
          try {
            await processSingleMessage(campaignId, msgId, organizationId);
          } catch (e) {}
        });
      }
    } catch (importErr) {
      console.warn('Fallback message dispatch warning:', importErr);
    }
  }
}
