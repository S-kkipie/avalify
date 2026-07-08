import { describe, expect, it, vi } from "vitest";
import { serve } from "./provider.js";
import { EventType } from "./client.js";

class FakeStream {
  private handlers = new Map<string, ((event: Record<string, string>) => void)[]>();

  on(eventType: string, handler: (event: Record<string, string>) => void): void {
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }

  close = vi.fn();

  async emit(eventType: string, event: Record<string, string>): Promise<void> {
    for (const handler of this.handlers.get(eventType) ?? []) await handler(event);
  }
}

function fakeCap(stream: FakeStream) {
  return {
    connectWebSocket: vi.fn().mockResolvedValue(stream),
    getNegotiation: vi.fn().mockResolvedValue({ negotiationId: "neg-1", requirements: '{"capability":"dataset-summary"}' }),
    acceptNegotiation: vi.fn().mockResolvedValue({ negotiation: {}, order: {} }),
    deliverOrder: vi.fn().mockResolvedValue({ order: {}, delivery: {}, txHash: "0xdeliver" }),
  };
}

describe("serve", () => {
  it("accepts negotiations, caches requirements, and delivers using onOrder's result on OrderPaid", async () => {
    const stream = new FakeStream();
    const cap = fakeCap(stream);
    const onOrder = vi.fn().mockResolvedValue({ deliverableType: "schema" as const, content: '{"status":"ok"}' });

    const handle = await serve(cap as any, onOrder);

    await stream.emit(EventType.NegotiationCreated, { negotiation_id: "neg-1" });
    expect(cap.getNegotiation).toHaveBeenCalledWith("neg-1");
    expect(cap.acceptNegotiation).toHaveBeenCalledWith("neg-1");

    await stream.emit(EventType.OrderPaid, { order_id: "order-1", negotiation_id: "neg-1" });

    expect(onOrder).toHaveBeenCalledWith({ orderId: "order-1", negotiationId: "neg-1", requirements: '{"capability":"dataset-summary"}' });
    expect(cap.deliverOrder).toHaveBeenCalledWith("order-1", "schema", '{"status":"ok"}');

    handle.close();
    expect(stream.close).toHaveBeenCalled();
  });
});
