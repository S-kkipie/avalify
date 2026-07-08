import type { Candidate, ReputationSignal } from "./types.js";
import type { AvalStore } from "./aval.js";
import type { Order, ListOptions } from "./cap/client.js";

export interface ReputationReader {
  read(candidate: Candidate): Promise<ReputationSignal>;
}

export interface OrderLister {
  listOrders(opts?: ListOptions): Promise<Order[]>;
}

export class ObservedReputationReader implements ReputationReader {
  constructor(private orders: OrderLister, private avalStore: AvalStore) {}

  async read(candidate: Candidate): Promise<ReputationSignal> {
    const history = await this.orders.listOrders({ agentId: candidate.agentId });
    const completed = history.filter((o) => o.status === "completed");
    const rejected = history.filter((o) => o.status === "rejected");
    const sampleSize = history.length;

    const completionRate = sampleSize > 0 ? completed.length / sampleSize : 0.5;
    const rejectRate = sampleSize > 0 ? rejected.length / sampleSize : 0;

    const ratios = completed.map(latencyRatio).filter((r): r is number => r !== null);
    const latencyRatioAvg = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 1;

    const avalHistory = await this.avalStore.history(candidate.serviceId);
    const avalScore = avalHistory.length > 0
      ? avalHistory.filter((a) => a.outcome === "positive").length / avalHistory.length
      : 0.5;

    return {
      serviceId: candidate.serviceId,
      completionRate,
      rejectRate,
      latencyRatio: latencyRatioAvg,
      avalScore,
      sampleSize,
    };
  }
}

function latencyRatio(order: Order): number | null {
  if (!order.deliveredAt || !order.createdAt || !order.slaDeadline) return null;
  const created = Date.parse(order.createdAt);
  const delivered = Date.parse(order.deliveredAt);
  const slaDeadline = Date.parse(order.slaDeadline);
  if (Number.isNaN(created) || Number.isNaN(delivered) || Number.isNaN(slaDeadline)) return null;
  const allowed = slaDeadline - created;
  if (allowed <= 0) return null;
  return (delivered - created) / allowed;
}
