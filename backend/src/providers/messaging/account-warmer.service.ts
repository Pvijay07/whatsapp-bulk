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
    // Initial warmup logs
    this.warmupLogs = [
      {
        id: 'wl-1',
        fromNumber: '+918045678901',
        toNumber: '+919876599999',
        snippet: 'Hey! Are you available to review the project brief today?',
        timestamp: '10:15 AM',
      },
      {
        id: 'wl-2',
        fromNumber: '+919876599999',
        toNumber: '+918045678901',
        snippet: 'Yes, looking at it right now. Everything seems on track! 👍',
        timestamp: '10:17 AM',
      },
    ];

    // Background interval: execute automated warmup conversation every 45 seconds
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

