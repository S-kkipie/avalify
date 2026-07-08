import { z } from "zod";

const AgentEnvSchema = z.object({
  apiUrl: z.string().url(),
  wsUrl: z.string().url(),
  rpcUrl: z.string().url().optional(),
  sdkKey: z.string().min(1),
  privateKey: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
});

export type AgentEnv = z.infer<typeof AgentEnvSchema>;

export function loadAgentEnv(prefix: string, env: NodeJS.ProcessEnv = process.env): AgentEnv {
  const get = (key: string) => env[`${prefix}_${key}`];
  return AgentEnvSchema.parse({
    apiUrl: env.CROO_API_URL,
    wsUrl: env.CROO_WS_URL,
    rpcUrl: env.CROO_RPC_URL || undefined,
    sdkKey: get("SDK_KEY"),
    privateKey: get("PRIVATE_KEY") || undefined,
  });
}
