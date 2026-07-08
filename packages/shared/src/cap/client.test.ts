import { describe, expect, it, vi } from "vitest";
import { CapClient, type AgentClientFactory } from "./client.js";
import type { AgentEnv } from "../env.js";

const fakeEnv: AgentEnv = {
  apiUrl: "https://api.croo.network",
  wsUrl: "wss://api.croo.network/ws",
  rpcUrl: undefined,
  sdkKey: "croo_sk_test",
  privateKey: undefined,
};

function fakeUnderlyingClient() {
  return {
    negotiateOrder: vi.fn().mockResolvedValue({ negotiationId: "neg-1" }),
    payOrder: vi.fn().mockResolvedValue({ order: { orderId: "order-1" }, txHash: "0xpay" }),
    acceptNegotiation: vi.fn().mockResolvedValue({ negotiation: {}, order: { orderId: "order-1" } }),
    deliverOrder: vi.fn().mockResolvedValue({ order: {}, delivery: {}, txHash: "0xdeliver" }),
    rejectOrder: vi.fn().mockResolvedValue(undefined),
    getOrder: vi.fn().mockResolvedValue({ orderId: "order-1", status: "completed" }),
    listOrders: vi.fn().mockResolvedValue([]),
    getDelivery: vi.fn().mockResolvedValue({ orderId: "order-1", deliverableType: "schema" }),
    getNegotiation: vi.fn().mockResolvedValue({ negotiationId: "neg-1", requirements: "{}" }),
    connectWebSocket: vi.fn().mockResolvedValue({ on: vi.fn(), onAny: vi.fn(), close: vi.fn() }),
  };
}

describe("CapClient", () => {
  it("delegates each method to the underlying AgentClient built by the factory", async () => {
    const underlying = fakeUnderlyingClient();
    const factory: AgentClientFactory = vi.fn().mockReturnValue(underlying);

    const cap = new CapClient(fakeEnv, factory);

    expect(factory).toHaveBeenCalledWith(
      { baseURL: fakeEnv.apiUrl, wsURL: fakeEnv.wsUrl, rpcURL: fakeEnv.rpcUrl },
      fakeEnv.sdkKey
    );

    await cap.negotiateOrder("service-1", '{"task":"x"}');
    expect(underlying.negotiateOrder).toHaveBeenCalledWith({ serviceId: "service-1", requirements: '{"task":"x"}' });

    await cap.payOrder("order-1");
    expect(underlying.payOrder).toHaveBeenCalledWith("order-1");

    await cap.deliverOrder("order-1", "schema", '{"ok":true}');
    expect(underlying.deliverOrder).toHaveBeenCalledWith("order-1", {
      deliverableType: "schema",
      deliverableText: undefined,
      deliverableSchema: '{"ok":true}',
    });

    await cap.getNegotiation("neg-1");
    expect(underlying.getNegotiation).toHaveBeenCalledWith("neg-1");

    await cap.connectWebSocket();
    expect(underlying.connectWebSocket).toHaveBeenCalled();
  });
});
