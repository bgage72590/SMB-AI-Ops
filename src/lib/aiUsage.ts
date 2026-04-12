import { recordAiUsage } from "./store";

// Per-million-token pricing, in USD. Kept here (rather than loaded from
// the API) so we can compute cost estimates without an extra round-trip
// and so the cost column stays stable across price updates.
//
// Sources: Anthropic public pricing (April 2025). When new models land,
// add a row here; unknown models default to the Opus 4.6 rate so we
// always show *something* rather than silently dropping to zero.
interface ModelPricing {
  input: number;
  output: number;
  cachedInput: number;
  cacheWrite: number;
}

const PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-6": {
    input: 15,
    output: 75,
    cachedInput: 1.5,
    cacheWrite: 18.75,
  },
  "claude-sonnet-4-6": {
    input: 3,
    output: 15,
    cachedInput: 0.3,
    cacheWrite: 3.75,
  },
  "claude-haiku-4-5-20251001": {
    input: 1,
    output: 5,
    cachedInput: 0.1,
    cacheWrite: 1.25,
  },
};

function pricingFor(model: string): ModelPricing {
  return PRICING[model] ?? PRICING["claude-opus-4-6"];
}

export interface UsageLike {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export function estimateCost(model: string, usage: UsageLike): number {
  const p = pricingFor(model);
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cached = usage.cache_read_input_tokens ?? 0;
  const written = usage.cache_creation_input_tokens ?? 0;
  return (
    (input * p.input) / 1_000_000 +
    (output * p.output) / 1_000_000 +
    (cached * p.cachedInput) / 1_000_000 +
    (written * p.cacheWrite) / 1_000_000
  );
}

export function logAiUsage(input: {
  userId: string;
  kind: string;
  model: string;
  usage: UsageLike;
}): void {
  try {
    const cost = estimateCost(input.model, input.usage);
    recordAiUsage({
      userId: input.userId,
      kind: input.kind,
      model: input.model,
      inputTokens: input.usage.input_tokens ?? 0,
      outputTokens: input.usage.output_tokens ?? 0,
      cachedInputTokens: input.usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: input.usage.cache_creation_input_tokens ?? 0,
      estimatedCostUsd: cost,
    });
  } catch (err) {
    // Never let usage logging break a user-facing AI call. We still want
    // the triage / draft to succeed even if the usage row can't be written.
    console.warn("recordAiUsage failed:", err);
  }
}
