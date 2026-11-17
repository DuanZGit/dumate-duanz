import test from "node:test"
import assert from "node:assert/strict"
import { DuMatePlugin } from "../index.mjs"

test("credentials are sent only to the official chat endpoint, without redirects", async () => {
  const hooks = await DuMatePlugin()
  const loader = await hooks.auth.loader(async () => ({ type: "oauth", cookies: [{ name: "bce-sessionid", value: "FAKE-SESSION", domain: ".baidu.com" }] }))
  const originalFetch = globalThis.fetch
  let calls = 0
  try {
    globalThis.fetch = async (url, init) => {
      calls++
      assert.equal(init.redirect, "error")
      if (String(url).includes("/api/dumate/app/token/get")) return Response.json({ code: 0, result: { token: "FAKE-TOKEN", expired_at: new Date(Date.now() + 3600000).toISOString() } })
      assert.equal(String(url), "https://dumate-svc.baidu.com/gateway/apis/v1/chat/completions")
      assert.equal(init.headers.get("Authorization"), "Bearer FAKE-TOKEN")
      assert.equal(init.headers.get("x-api-key"), null)
      assert.equal(JSON.parse(init.body).model, "deepseek-v41-flash")
      return Response.json({ model: "deepseek-v41-flash", choices: [{ message: { content: "OK" } }] })
    }
    for (const url of ["https://example.invalid/chat/completions", "http://dumate-svc.baidu.com/gateway/apis/v1/chat/completions", "https://dumate-svc.baidu.com/other", "https://user:fake@dumate-svc.baidu.com/gateway/apis/v1/chat/completions"]) {
      assert.equal((await loader.fetch(url, { method: "POST", body: "{}" })).status, 400)
    }
    assert.equal(calls, 0)
    const r = await loader.fetch(new Request("https://dumate-svc.baidu.com/gateway/apis/v1/chat/completions", { method: "POST", headers: { "x-api-key": "FAKE-CLIENT-KEY" }, body: JSON.stringify({ model: "deepseek-v41-flash" }) }))
    assert.equal(r.status, 200)
    assert.equal(calls, 2)
  } finally { globalThis.fetch = originalFetch }
})

test("remote image URLs are inlined as data URIs before the chat call; failures pass through", async () => {
  const hooks = await DuMatePlugin()
  const loader = await hooks.auth.loader(async () => ({ type: "oauth", cookies: [{ name: "bce-sessionid", value: "FAKE-SESSION", domain: ".baidu.com" }] }))
  const originalFetch = globalThis.fetch
  let bodies = []
  const png = Buffer.from("89504e470d0a1a0a000000", "hex") // PNG-magic-ish bytes
  try {
    globalThis.fetch = async (url, init) => {
      const u = String(url)
      if (u === "https://images.example.invalid/pic.png") {
        return new Response(png, { status: 200, headers: { "content-type": "image/png" } })
      }
      if (u === "https://dead.example.invalid/pic.png") return new Response("nope", { status: 403 })
      if (u === "https://evil.example.invalid/page.html") return new Response("<html>", { status: 200, headers: { "content-type": "text/html" } })
      // gateway token endpoint
      if (u.includes("/api/dumate/app/token/get")) return Response.json({ code: 0, result: { token: "FAKE-TOKEN", expired_at: new Date(Date.now() + 3600000).toISOString() } })
      bodies.push(JSON.parse(init.body))
      return Response.json({ model: "x", choices: [{ message: { content: "OK" } }] })
    }
    const payload = {
      model: "deepseek-v41-flash",
      messages: [
        { role: "user", content: [
          { type: "text", text: "看图" },
          { type: "image_url", image_url: { url: "https://images.example.invalid/pic.png" } },
          { type: "image_url", image_url: { url: "https://dead.example.invalid/pic.png" } },
          { type: "image_url", image_url: { url: "https://evil.example.invalid/page.html" } },
          { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
        ] },
      ],
    }
    const r = await loader.fetch("https://dumate-svc.baidu.com/gateway/apis/v1/chat/completions", { method: "POST", body: JSON.stringify(payload) })
    assert.equal(r.status, 200)
    assert.equal(bodies.length, 1)
    const parts = bodies[0].messages[0].content
    assert.match(parts[1].image_url.url, /^data:image\/png;base64,/) // downloaded
    assert.equal(parts[2].image_url.url, "https://dead.example.invalid/pic.png") // 403 → untouched
    assert.equal(parts[3].image_url.url, "https://evil.example.invalid/page.html") // non-image → untouched
    assert.equal(parts[4].image_url.url, "data:image/png;base64,AAAA") // data URI untouched
    // non-JSON body passes through unchanged (mock gateway tolerates it)
    globalThis.fetch = async (url, init) => {
      const u = String(url)
      if (u.includes("/api/dumate/app/token/get")) return Response.json({ code: 0, result: { token: "FAKE-TOKEN", expired_at: new Date(Date.now() + 3600000).toISOString() } })
      assert.equal(init.body, "not-json")
      return Response.json({ model: "x", choices: [{ message: { content: "OK" } }] })
    }
    const r2 = await loader.fetch("https://dumate-svc.baidu.com/gateway/apis/v1/chat/completions", { method: "POST", body: "not-json" })
    assert.equal(r2.status, 200)
  } finally { globalThis.fetch = originalFetch }
})
