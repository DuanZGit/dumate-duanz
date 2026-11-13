// Re-measure what each DuMate model actually costs in points.
//
// Baidu publishes no per-model points table, so the percentages in
// ../catalog.mjs come from talking to the real gateway and reading the
// usedPoints delta out of /api/dumate/points/quota_overview.
//
//   node scripts/measure-rates.mjs                 # every known chat model
//   node scripts/measure-rates.mjs glm-53 kim-k3   # just these
//
// Needs a signed-in DuMate account in ~/.config/magpie/plugin-auth.json.
// Each model costs two chat calls (~1-2 points for the expensive tiers).
// The gateway rate-limits aggressively: the script backs off and retries.
import fs from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HOME = process.env.HOME ?? homedir();
const authFile = join(HOME, ".config/magpie/plugin-auth.json");
let auth;
try {
  auth = JSON.parse(fs.readFileSync(authFile, "utf8"));
} catch (e) {
  console.error(`Cannot read ${authFile}: ${e.message}. Run: magpie plugin login dumate`);
  process.exit(1);
}
const entry = auth?.dumate;
if (!entry?.access) {
  console.error(`No DuMate sign-in in ${authFile}. Run: magpie plugin login dumate`);
  process.exit(1);
}
const cookie = String(entry.access).replace(/^cookie:/, "");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) DuMate/1.0.91 Chrome/130.0.0.0 Electron/33.0.0 Safari/537.36";

const H = {
  Cookie: cookie,
  Accept: "application/json",
  "Content-Type": "application/json",
  "User-Agent": UA,
  Referer: "https://console.bce.baidu.com/ai_apaas/dumate",
  Origin: "https://console.bce.baidu.com",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const QUOTA =
  "https://console.bce.baidu.com/api/dumate/points/quota_overview?timezone=Asia%2FShanghai&clientType=desktop&ignoreLoginBonus=true";

async function usedPoints() {
  const r = await fetch(QUOTA, { headers: H, redirect: "error" });
  const j = await r.json();
  return Number(j?.result?.usedPoints ?? NaN);
}

let token = "";
async function gatewayToken() {
  if (token) return token;
  const r = await fetch("https://console.bce.baidu.com/api/dumate/app/token/get", { headers: H, redirect: "error" });
  const j = await r.json();
  token = String(j?.result?.token ?? "");
  return token;
}

async function chat(model, prompt, maxTokens) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const bearer = await gatewayToken();
    const r = await fetch("https://dumate-svc.baidu.com/gateway/apis/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: maxTokens, stream: false }),
      redirect: "error",
    });
    const text = await r.text();
    let j = null;
    try { j = JSON.parse(text); } catch {}
    if (r.status === 429 || /rate_limit/.test(j?.error?.message ?? "")) {
      // Backing off is the only option; the limit is per account.
      await sleep(20_000 * (attempt + 1));
      continue;
    }
    if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${(j?.error?.message ?? text).slice(0, 120)}`);
    return j.usage;
  }
  throw new Error("still rate limited after 8 attempts");
}

// Two lengths so the fixed per-call overhead cancels out and only the
// output-token slope survives.
const SHORT = "请只回复两个字：收到";
const LONG = "请从 1 数到 200，数字之间用逗号分隔，不要任何其他文字";

async function measure(model) {
  const before = await usedPoints();
  const a = await chat(model, SHORT, 24);
  await sleep(1500);
  const mid = await usedPoints();
  const b = await chat(model, LONG, 800);
  await sleep(1500);
  const after = await usedPoints();

  const dShort = mid - before;
  const dLong = after - mid;
  const dTokens = b.completion_tokens - a.completion_tokens;
  if (!(dTokens > 50)) return { model, error: "output too short to separate the slope" };
  const outPerK = ((dLong - dShort) / dTokens) * 1000;
  const inPerK = (dShort - a.completion_tokens * (outPerK / 1000)) / Math.max(1, a.prompt_tokens) * 1000;
  return {
    model,
    pointsPerKOut: Number(outPerK.toFixed(4)),
    pointsPerKIn: inPerK > 0 ? Number(inPerK.toFixed(4)) : null,
    tokens: `${a.prompt_tokens}+${a.completion_tokens} / ${b.prompt_tokens}+${b.completion_tokens}`,
  };
}

const KNOWN = [
  "deepseek-v41-flash", "deepseek-v4-flash-0731", "deepseek-v4-pro",
  "glm-53", "glm-53-flash", "kimi-k3", "kimi-k31",
  "qwen3.8-max", "qwen38-flash", "qwen3.5-397b-a17b", "qwen3.5-35b-a3b",
  "qwen3.5-27b", "qwen2.5-vl-32b-instruct",
  "doubao-seed-2-0-pro", "ernie-4.5-turbo-vl-32k", "model-text",
];

const targets = process.argv.length > 2 ? process.argv.slice(2) : KNOWN;
const rows = [];
for (const model of targets) {
  try {
    rows.push(await measure(model));
  } catch (e) {
    rows.push({ model, error: String(e.message).slice(0, 120) });
  }
  process.stderr.write(".");
  await sleep(3000);
}
process.stderr.write("\n");

const basis = rows.find((r) => r.model === "deepseek-v41-flash" && r.pointsPerKOut)?.pointsPerKOut;
for (const r of rows.sort((x, y) => (y.pointsPerKOut ?? -1) - (x.pointsPerKOut ?? -1))) {
  if (r.error) {
    console.log(`${r.model.padEnd(26)} ERROR  ${r.error}`);
    continue;
  }
  const pct = basis ? `${((r.pointsPerKOut / basis) * 100).toFixed(1)}%` : "-";
  console.log(`${r.model.padEnd(26)} ${String(r.pointsPerKOut).padStart(7)} pts/1k out   ${pct.padStart(7)}   in=${r.pointsPerKIn ?? "?"}  (${r.tokens})`);
}
