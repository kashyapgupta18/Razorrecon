// ============================================================
// RazorRecon AI — In-Memory Event Bus for Real-Time Broadcasting
// Typed channels, subscriber management, event replay buffer
// ============================================================

export type EventChannel =
  | 'recon:progress'      // Reconciliation progress updates
  | 'recon:completed'     // Reconciliation run completed
  | 'match:created'       // New match candidate found
  | 'match:updated'       // Match approved/rejected
  | 'exception:created'   // New exception raised
  | 'exception:updated'   // Exception status changed
  | 'txn:ingested'        // New transaction ingested (live simulator)
  | 'health:updated'      // Health score recalculated
  | 'anomaly:detected'    // Anomaly signal triggered
  | 'system:heartbeat'    // System vitals pulse
  | 'ai:response'         // AI copilot response streaming
  | 'benchmark:progress'; // Benchmark progress

export interface BusEvent {
  channel: EventChannel;
  data: Record<string, unknown>;
  timestamp: string;
  id: string;
}

type Subscriber = (event: BusEvent) => void;

class EventBus {
  private subscribers: Map<string, Set<Subscriber>> = new Map();
  private globalSubscribers: Set<Subscriber> = new Set();
  private replayBuffer: BusEvent[] = [];
  private maxReplay = 50;
  private eventCounter = 0;

  emit(channel: EventChannel, data: Record<string, unknown>): void {
    const event: BusEvent = {
      channel,
      data,
      timestamp: new Date().toISOString(),
      id: `evt_${Date.now()}_${++this.eventCounter}`,
    };

    this.replayBuffer.push(event);
    if (this.replayBuffer.length > this.maxReplay) {
      this.replayBuffer.shift();
    }

    // Channel-specific subscribers
    const channelSubs = this.subscribers.get(channel);
    if (channelSubs) {
      for (const sub of channelSubs) {
        try { sub(event); } catch (e) { console.error(`EventBus subscriber error on ${channel}:`, e); }
      }
    }

    // Global subscribers (for WebSocket broadcast)
    for (const sub of this.globalSubscribers) {
      try { sub(event); } catch (e) { console.error('EventBus global subscriber error:', e); }
    }
  }

  subscribe(channel: EventChannel, callback: Subscriber): () => void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    this.subscribers.get(channel)!.add(callback);
    return () => { this.subscribers.get(channel)?.delete(callback); };
  }

  subscribeAll(callback: Subscriber): () => void {
    this.globalSubscribers.add(callback);
    return () => { this.globalSubscribers.delete(callback); };
  }

  getReplayBuffer(): BusEvent[] {
    return [...this.replayBuffer];
  }

  getStats() {
    const channelCounts: Record<string, number> = {};
    for (const [ch, subs] of this.subscribers) {
      channelCounts[ch] = subs.size;
    }
    return {
      totalEvents: this.eventCounter,
      globalSubscribers: this.globalSubscribers.size,
      channelSubscribers: channelCounts,
      replayBufferSize: this.replayBuffer.length,
    };
  }
}

// Singleton
export const eventBus = new EventBus();
