// Local overrides for the DuMate catalog: readable names, and the price each
// model costs so magpie can show its own cost ratio (×N).
//
// Baidu publishes no per-model points table — the billing doc only says model
// calls are "converted to points". So the points rates below are MEASURED, not
// documented: two chat calls per model at different output lengths against the
// real gateway, reading usedPoints deltas from
// /api/dumate/points/quota_overview. Points-per-1k-output was stable across
// 600/1500/3000-token runs, so the spread is real, not measurement noise.
// usedPoints has 0.01 resolution, so the cheap tiers carry roughly ±10% error.
//
// Re-measure with scripts/measure-rates.mjs when Baidu reprices.
export const RATE_BASIS = "2026-11-13"

// Points per 1k OUTPUT tokens.
export const OUTPUT_RATES = {
  "kimi-k3": 6.235,
  "qwen2.5-vl-32b-instruct": 2.024,
  "model-text": 2.014,
  "deepseek-v4-flash-0731": 2.007,
  "deepseek-v41-flash": 2.0,
  "ernie-4.5-turbo-vl-32k": 1.997,
  "qwen3.8-max": 1.905,
  "doubao-seed-2-0-pro": 0.193,
  "glm-53-flash": 0.122,
  "kimi-k31": 0.117,
  "qwen38-flash": 0.1,
  "deepseek-v4-pro": 0.1,
  "qwen3.5-397b-a17b": 0.098,
  "glm-53": 0.087,
  "qwen3.5-27b": 0.067,
  "qwen3.5-35b-a3b": 0.05,
}

// Points per 1k INPUT tokens. Only these four were measured; the rest are
// estimated at 0.30 × the output rate, which is the ratio the measured ones
// cluster around (0.305, 0.328).
export const INPUT_RATES_MEASURED = {
  "deepseek-v41-flash": 0.611,
  "deepseek-v4-pro": 0.089,
  "kimi-k3": 1.213,
  "qwen3.8-max": 0.625,
}
const INPUT_RATIO_ESTIMATE = 0.3

// Pro is ¥59 for 25,000 points (Baidu's billing page). That is the only
// official price anchor; a Max plan or a redeemed voucher has a different one.
// Converted at ¥7.10/$. Both constants are assumptions, not quoted rates —
// they only need to stay consistent, since magpie's ratio is relative.
export const YUAN_PER_POINT = 59 / 25000
export const CNY_PER_USD = 7.1
const USD_PER_POINT = YUAN_PER_POINT / CNY_PER_USD

// Cache behaviour is not exposed by the gateway. Read is priced at 10% of
// input and write at input cost — the usual vendor shape, nothing measured.
const CACHE_READ_FACTOR = 0.1
const CACHE_WRITE_FACTOR = 1

// The gateway resolves these aliases to a concrete model at request time, so
// neither a name nor a price can be pinned to them.
export const AUTO_ROUTED = /^dm-auto-model\//

export const NAMES = {
  "deepseek-v4-flash-0731": "DeepSeek-V4-Flash-0731",
  "deepseek-v4-pro": "DeepSeek-V4 Pro",
  "deepseek-v41-flash": "DeepSeek-V4.1 Flash",
  "dm-auto-model/mm.L0": "自动·多模态 L0",
  "dm-auto-model/mm.L1": "自动·多模态 L1",
  "dm-auto-model/mm.L2": "自动·多模态 L2",
  "dm-auto-model/text.L0": "自动·文本 L0",
  "dm-auto-model/text.L1": "自动·文本 L1",
  "dm-auto-model/text.L2": "自动·文本 L2",
  "doubao-seed-2-0-pro": "豆包 Seed 2.0 Pro",
  "ernie-4.5-turbo-vl-32k": "文心 ERNIE-4.5 Turbo VL",
  "glm-53": "GLM-5.3",
  "glm-53-flash": "GLM-5.3 Flash",
  "kimi-k3": "Kimi K3",
  "kimi-k31": "Kimi K3.1",
  "model-text": "自动路由（默认）",
  "qwen2.5-vl-32b-instruct": "Qwen2.5-VL-32B",
  "qwen3.5-27b": "Qwen3.5-27B",
  "qwen3.5-35b-a3b": "Qwen3.5-35B-A3B",
  "qwen3.5-397b-a17b": "Qwen3.5-397B-A17B",
  "qwen3.8-max": "Qwen3.8 Max",
  "qwen38-flash": "Qwen3.8 Flash",
}

const round = (n) => Math.round(n * 1e6) / 1e6

// Points per 1k input tokens for a model.
export function inputRate(id) {
  const measured = INPUT_RATES_MEASURED[id]
  if (measured != null) return measured
  const out = OUTPUT_RATES[id]
  return out == null ? null : out * INPUT_RATIO_ESTIMATE
}

// magpie's model cost shape: USD per 1M tokens.
// Returns undefined for models whose price cannot be pinned down — magpie then
// falls back to models.dev, and shows no ratio rather than a wrong one.
export function costOf(id) {
  if (AUTO_ROUTED.test(id)) return undefined
  const out = OUTPUT_RATES[id]
  const inp = inputRate(id)
  if (out == null || inp == null) return undefined
  const input = round(inp * 1000 * USD_PER_POINT)
  return {
    input,
    output: round(out * 1000 * USD_PER_POINT),
    cache: { read: round(input * CACHE_READ_FACTOR), write: round(input * CACHE_WRITE_FACTOR) },
  }
}

// Just the readable name. No ratio here: magpie computes and shows its own
// ratio from the cost above, and two numbers on one model contradict.
export function label(id, fallback) {
  return NAMES[id] ?? fallback ?? id
}
