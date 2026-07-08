import { EventType, type CapClient } from "./client.js";
import type { Candidate, JobSpec } from "../types.js";

export interface HireResult {
  orderId: string;
  deliverableType: "text" | "schema";
  deliverableText: string;
  deliverableSchema: string;
  payTxHash: string;
  deliverTxHash: string;
}

export class Requester {
  constructor(private cap: CapClient, private timeoutMs = 60_000) {}

  async hire(candidate: Candidate, job: JobSpec): Promise<HireResult> {
    const stream = await this.cap.connectWebSocket();
    try {
      const negotiation = await this.cap.negotiateOrder(candidate.serviceId, JSON.stringify(job.input));

      const orderId = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`Timed out waiting for order creation for negotiation ${negotiation.negotiationId}`)),
          this.timeoutMs
        );
        stream.on(EventType.OrderCreated, (e: { negotiation_id?: string; order_id?: string }) => {
          if (e.negotiation_id === negotiation.negotiationId && e.order_id) {
            clearTimeout(timer);
            resolve(e.order_id);
          }
        });
      });

      const paid = await this.cap.payOrder(orderId);

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`Timed out waiting for completion of order ${orderId}`)),
          this.timeoutMs
        );
        stream.on(EventType.OrderCompleted, (e: { order_id?: string }) => {
          if (e.order_id === orderId) {
            clearTimeout(timer);
            resolve();
          }
        });
      });

      const [delivery, order] = await Promise.all([this.cap.getDelivery(orderId), this.cap.getOrder(orderId)]);

      return {
        orderId,
        deliverableType: delivery.deliverableType as "text" | "schema",
        deliverableText: delivery.deliverableText,
        deliverableSchema: delivery.deliverableSchema,
        payTxHash: paid.txHash,
        deliverTxHash: order.deliverTxHash,
      };
    } finally {
      stream.close();
    }
  }

  async tryReject(orderId: string, reason: string): Promise<boolean> {
    try {
      await this.cap.rejectOrder(orderId, reason);
      return true;
    } catch {
      return false;
    }
  }
}
