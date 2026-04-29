# Deploy Webmaker (production checklist)

Do these once per environment. After this, `npm run build && npm start` (or Vercel) should work.

---

## 1. Required: AI generation

| Variable | Where |
|----------|--------|
| `OPENROUTER_API_KEY` | Vercel / `.env.local` |

Get a key at [OpenRouter](https://openrouter.ai/). Without this, `/api/generate` fails.

Verify: open `/api/health` — `checks.openrouter.ok` must be `true`.

---

## 2. Optional but recommended: shared preview links

Used by `POST /api/preview` to store preview payloads across instances.

| Variable | Where |
|----------|--------|
| `UPSTASH_REDIS_REST_URL` | From [Upstash](https://upstash.com/) Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Same database REST token |

If both are unset, previews still work on **one** Node process (uses OS temp files). On **Vercel/serverless**, set Upstash or preview IDs may 404 on a different instance.

Verify: `/api/health` → `checks.upstashRedis.ok`.

---

## 3. Optional: live Cloudflare Sandbox (Studio runtime)

Sandpack in the UI works **without** this. Gateway adds **Install deps / Run command / Start preview** against a real container.

### 3a. Deploy the Worker

```bash
cd workers/sandbox-gateway
npm install
```

1. Edit **`wrangler.toml`** `[vars]` → set `SANDBOX_PREVIEW_HOSTNAME` to a hostname you control (not `localhost`). You need **wildcard DNS** for that host pointing at Cloudflare — see [Sandbox preview URLs](https://developers.cloudflare.com/sandbox/concepts/preview-urls/).
2. Set the shared secret:

```bash
npx wrangler secret put SANDBOX_API_SECRET
```

(pick a long random string; reuse it in Webmaker as below.)

3. Deploy:

```bash
npm run deploy
```

Note the Worker URL (e.g. `https://webmaker-sandbox-gateway.<account>.workers.dev`).

### 3b. Configure the Next.js app

| Variable | Value |
|----------|--------|
| `SANDBOX_GATEWAY_URL` | Worker URL, **no trailing slash** |
| `SANDBOX_GATEWAY_SECRET` | **Same** value as Worker `SANDBOX_API_SECRET` |

Verify: `/api/health` → `checks.sandboxGateway.ok`. In Studio, **Start preview** should return an `https://` preview URL and the Preview tab can iframe it.

---

## 4. Smoke test after deploy

1. `GET /api/health` — expect `status: "ok"` when everything you need is green (degraded is OK if you intentionally skipped sandbox/Redis).
2. Open `/studio`, send a short prompt — generation should stream.
3. If sandbox is configured — **Runtime → Start Preview** — iframe should load the dev server.

---

## 5. Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| 503 on `/api/health` | Missing `OPENROUTER_API_KEY` |
| Generation errors | Key invalid or model id issue — check OpenRouter dashboard |
| Sandbox “Unauthorized” | `SANDBOX_GATEWAY_SECRET` ≠ Worker `SANDBOX_API_SECRET` |
| `exposePort` / preview URL errors | Fix `SANDBOX_PREVIEW_HOSTNAME` + wildcard DNS (not `workers.dev` for production previews per CF docs) |
| Preview link 404 on Vercel | Add Upstash Redis vars |

Legacy vars like `CLOUDFLARE_ACCOUNT_ID` are **not** required for the HTTP gateway path — only the Worker + gateway URL/secret above.
