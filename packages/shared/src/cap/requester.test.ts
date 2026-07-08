import { describe, expect, it, vi } from "vitest";
import { Requester } from "./requester.js";
import { EventType } from "./client.js";
import type { Candidate, JobSpec } from "../types.js";

const candidate: Candidate = { serviceId: "svc-1", agentId: "agent-1", priceUsdc: 0.5, slaSeconds: 60, deliverableType: "schema" };
const job: JobSpec = { capability: "dataset-summary", input: { dataset: "x" }, acceptSchema: {} as JobSpec["acceptSchema"], maxPriceUsdc: 1 };

class FakeStream {
  private handlers = new Map<string, ((event: Record<string, string>) => void)[]>();

  on(eventType: string, handler: (event: Record<string, string>) => void): void {
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }

  close = vi.fn();

  emit(eventType: string, event: Record<string, string>): void {
    for (const handler of this.handlers.get(eventType) ?? []) handler(event);
  }
}

function fakeCap(stream: FakeStream) {
  return {
    connectWebSocket: vi.fn().mockResolvedValue(stream),
    negotiateOrder: vi.fn().mockResolvedValue({ negotiationId: "neg-1" }),
    payOrder: vi.fn().mockResolvedValue({ order: { orderId: "order-1" }, txHash: "0xpay" }),
    getOrder: vi.fn().mockResolvedValue({ orderId: "order-1", deliverTxHash: "0xdeliver" }),
    getDelivery: vi.fn().mockResolvedValue({ deliverableType: "schema", deliverableText: "", deliverableSchema: '{"ok":true}' }),
    rejectOrder: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Requester.hire", () => {
  it("negotiates, waits for OrderCreated, pays, waits for OrderCompleted, then fetches the delivery", async () => {
    const stream = new FakeStream();
    const cap = fakeCap(stream);
    const requester = new Requester(cap as any, 5_000);

    const hirePromise = requester.hire(candidate, job);

    await vi.waitFor(() => expect(cap.negotiateOrder).toHaveBeenCalled());
    stream.emit(EventType.OrderCreated, { negotiation_id: "neg-1", order_id: "order-1" });

    await vi.waitFor(() => expect(cap.payOrder).toHaveBeenCalledWith("order-1"));
    stream.emit(EventType.OrderCompleted, { order_id: "order-1" });

    const result = await hirePromise;

    expect(result.orderId).toBe("order-1");
    expect(result.deliverableSchema).toBe('{"ok":true}');
    expect(result.payTxHash).toBe("0xpay");
    expect(result.deliverTxHash).toBe("0xdeliver");
    expect(stream.close).toHaveBeenCalled();
  });
});

describe("Requester.tryReject", () => {
  it("returns true when rejectOrder succeeds", async () => {
    const stream = new FakeStream();
    const cap = fakeCap(stream);
    const requester = new Requester(cap as any, 5_000);
    await expect(requester.tryReject("order-1", "bad delivery")).resolves.toBe(true);
  });

  it("returns false when rejectOrder throws (order state no longer allows it)", async () => {
    const stream = new FakeStream();
    const cap = fakeCap(stream);
    cap.rejectOrder.mockRejectedValue(new Error("invalid status"));
    const requester = new Requester(cap as any, 5_000);
    await expect(requester.tryReject("order-1", "bad delivery")).resolves.toBe(false);
  });
});
