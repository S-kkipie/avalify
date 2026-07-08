import { describe, expect, it } from "vitest";
import { loadAgentEnv } from "./env.js";

describe("loadAgentEnv", () => {
  it("parses a valid agent env under a prefix", () => {
    const fakeEnv = {
      CROO_API_URL: "https://api.croo.network",
      CROO_WS_URL: "wss://api.croo.network/ws",
      AVALIFY_SDK_KEY: "croo_sk_test",
      AVALIFY_PRIVATE_KEY: "0x" + "1".repeat(64),
    };

    const result = loadAgentEnv("AVALIFY", fakeEnv as unknown as NodeJS.ProcessEnv);

    expect(result).toEqual({
      apiUrl: "https://api.croo.network",
      wsUrl: "wss://api.croo.network/ws",
      rpcUrl: undefined,
      sdkKey: "croo_sk_test",
      privateKey: "0x" + "1".repeat(64),
    });
  });

  it("throws when the sdk key is missing", () => {
    const fakeEnv = {
      CROO_API_URL: "https://api.croo.network",
      CROO_WS_URL: "wss://api.croo.network/ws",
    };

    expect(() => loadAgentEnv("AVALIFY", fakeEnv as unknown as NodeJS.ProcessEnv)).toThrow();
  });
});
