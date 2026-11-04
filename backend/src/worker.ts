import { Logger } from '@nestjs/common';
import { messagingWorker } from './queue/messaging.worker';

const logger = new Logger('WorkerBootstrap');

async function bootstrap() {
  logger.log('Starting WhatsApp SaaS Background Worker...');
  logger.log(`Worker listening to queue: ${messagingWorker.name}`);

  process.on('SIGTERM', async () => {
    logger.log('Received SIGTERM, closing worker gracefully...');
    await messagingWorker.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('Received SIGINT, closing worker gracefully...');
    await messagingWorker.close();
    process.exit(0);
  });
}

bootstrap();

