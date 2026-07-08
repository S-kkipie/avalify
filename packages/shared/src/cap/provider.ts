import { EventType, type CapClient } from "./client.js";

export interface OrderContext {
  orderId: string;
  negotiationId: string;
  requirements: string;
}

export interface DeliverFn {
  (ctx: OrderContext): Promise<{ deliverableType: "text" | "schema"; content: string }>;
}

export async function serve(cap: CapClient, onOrder: DeliverFn): Promise<{ close: () => void }> {
  const stream = await cap.connectWebSocket();
  const requirementsByNegotiation = new Map<string, string>();

  stream.on(EventType.NegotiationCreated, async (e: { negotiation_id?: string }) => {
    if (!e.negotiation_id) return;
    const negotiation = await cap.getNegotiation(e.negotiation_id);
    requirementsByNegotiation.set(e.negotiation_id, negotiation.requirements);
    await cap.acceptNegotiation(e.negotiation_id);
  });

  stream.on(EventType.OrderPaid, async (e: { order_id?: string; negotiation_id?: string }) => {
    if (!e.order_id || !e.negotiation_id) return;
    const requirements = requirementsByNegotiation.get(e.negotiation_id) ?? "{}";
    const { deliverableType, content } = await onOrder({ orderId: e.order_id, negotiationId: e.negotiation_id, requirements });
    await cap.deliverOrder(e.order_id, deliverableType, content);
  });

  return { close: () => stream.close() };
}
