import { DEFAULT_WEIGHTS, DEFAULT_GUARDRAILS, type GuardrailConfig, type RankingWeights } from "@avalify/shared";

export const rankingWeights: RankingWeights = { ...DEFAULT_WEIGHTS };

export const guardrails: GuardrailConfig = { ...DEFAULT_GUARDRAILS, maxRouteArounds: 3 };
