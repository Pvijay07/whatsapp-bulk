import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { VirtualPoolManagerService } from './virtual-pool-manager.service';

export interface WarmupLogEntry {
  id: string;
  fromNumber: string;
  toNumber: string;
  snippet: string;
  timestamp: string;
}

@Injectable()
export class AccountWarmerService implements OnModuleInit {
  private readonly logger = new Logger(AccountWarmerService.name);
  private warmupLogs: WarmupLogEntry[] = [];
  private isAutoWarmingEnabled = true;

  constructor(private readonly poolManager: VirtualPoolManagerService) {}

  onModuleInit() {
    this.logger.log('Starting Account Warmer Service...');
    this.warmupLogs = [];

    // Background interval: execute automated warmup conversation every 45 seconds if at least 2 real numbers exist
    setInterval(() => {
      if (this.isAutoWarmingEnabled) {
        this.runWarmupCycle();
      }
    }, 45000);
  }

  runWarmupCycle() {
    const result = this.poolManager.simulateWarmupRound();
    if (result) {
      const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const entry: WarmupLogEntry = {
        id: `wl-${Date.now()}`,
        fromNumber: result.fromNumber,
        toNumber: result.toNumber,
        snippet: result.snippet,
        timestamp: now,
      };

      this.warmupLogs.unshift(entry);
      if (this.warmupLogs.length > 50) {
        this.warmupLogs.pop();
      }
      return entry;
    }
    return null;
  }

  getWarmupLogs(): WarmupLogEntry[] {
    return this.warmupLogs;
  }

  toggleAutoWarming(enable: boolean) {
    this.isAutoWarmingEnabled = enable;
    this.logger.log(`Account auto-warming ${enable ? 'enabled' : 'paused'}.`);
    return { enabled: this.isAutoWarmingEnabled };
  }
}

