// Local overrides for the DuMate catalog: readable names and the points rate
// each model burns, relative to DeepSeek-V4.1 Flash.
//
// Rates are MEASURED, not read from any documented table — Baidu publishes no
// per-model points table. Method: two chat calls per model at different output
// lengths against the real gateway, reading usedPoints deltas from
// /api/dumate/points/quota_overview. Points-per-1k-output-token was stable
// across 600/1500-token runs (deepseek-v4-pro: 0.100 / 0.1067), so the spread
// below is real, not measurement noise. Resolution is 0.01 points, so the
// cheap tiers carry roughly +-10% error.
//
// Re-measure with scripts/measure-rates.mjs when Baidu reprices.
export const RATE_BASIS = "2026-11-13"

// points per 1k output tokens (basis: deepseek-v41-flash = 2.00)
export const RATES = {
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

export const RATE_BASE = "deepseek-v41-flash"

// The gateway resolves these aliases to a concrete model at request time, so a
// fixed rate would be a lie. Shown as "auto" instead of a number.
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

const pct = (rate) => {
  const base = RATES[RATE_BASE]
  const r = (rate / base) * 100
  if (r >= 10) return `${Math.round(r)}%`
  if (r >= 1) return `${r.toFixed(1)}%`
  return `${r.toFixed(2)}%`
}

// "DeepSeek-V4.1 Flash · 100%" — the percentage is how much of the base
// model's point burn this one costs for the same output.
export function label(id, fallback) {
  const name = NAMES[id] ?? fallback ?? id
  const rate = RATES[id]
  if (AUTO_ROUTED.test(id)) return `${name} · 倍率随路由`
  if (rate == null) return name
  return `${name} · ${pct(rate)}`
}
