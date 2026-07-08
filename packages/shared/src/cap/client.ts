import { AgentClient, EventType, DeliverableType } from "@croo-network/sdk";
import type { Config, Order, Delivery, Negotiation, AcceptNegotiationResult, PayOrderResult, DeliverOrderResult, ListOptions } from "@croo-network/sdk";
import type { AgentEnv } from "../env.js";

export { EventType, DeliverableType };
export type { Order, Delivery, Negotiation, ListOptions };

export type AgentClientFactory = (config: Config, sdkKey: string) => AgentClient;

const defaultFactory: AgentClientFactory = (config, sdkKey) => new AgentClient(config, sdkKey);

export class CapClient {
  private client: AgentClient;

  constructor(env: AgentEnv, factory: AgentClientFactory = defaultFactory) {
    this.client = factory({ baseURL: env.apiUrl, wsURL: env.wsUrl, rpcURL: env.rpcUrl }, env.sdkKey);
  }

  async negotiateOrder(serviceId: string, requirements: string): Promise<Negotiation> {
    return this.client.negotiateOrder({ serviceId, requirements });
  }

  async acceptNegotiation(negotiationId: string): Promise<AcceptNegotiationResult> {
    return this.client.acceptNegotiation(negotiationId);
  }

  async payOrder(orderId: string): Promise<PayOrderResult> {
    return this.client.payOrder(orderId);
  }

  async deliverOrder(orderId: string, deliverableType: "text" | "schema", content: string): Promise<DeliverOrderResult> {
    return this.client.deliverOrder(orderId, {
      deliverableType,
      deliverableText: deliverableType === "text" ? content : undefined,
      deliverableSchema: deliverableType === "schema" ? content : undefined,
    });
  }

  async rejectOrder(orderId: string, reason: string): Promise<void> {
    return this.client.rejectOrder(orderId, reason);
  }

  async getOrder(orderId: string): Promise<Order> {
    return this.client.getOrder(orderId);
  }

  async listOrders(opts?: ListOptions): Promise<Order[]> {
    return this.client.listOrders(opts);
  }

  async getDelivery(orderId: string): Promise<Delivery> {
    return this.client.getDelivery(orderId);
  }

  async getNegotiation(negotiationId: string): Promise<Negotiation> {
    return this.client.getNegotiation(negotiationId);
  }

  async connectWebSocket() {
    return this.client.connectWebSocket();
  }
}
