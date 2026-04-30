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

## 3. Optional: Cloudflare Sandbox runtime

Current repo status as of April 29, 2026:

- Studio UI supports selecting `cloudflare-sandbox`
- agent/runtime prompts now describe Cloudflare Sandbox SDK semantics
- the Worker scaffold now exists under `workers/sandbox-gateway`
- the Next.js app now calls the gateway when `cloudflare-sandbox` is selected
- root scripts now exist for local worker dev and deploy

That means the code path is implemented, but Cloudflare is still **not connected** until you deploy and configure the worker in your own account.

### What "connected" actually means

Cloudflare is connected only when all of the following are true:

1. A Worker gateway exists in `workers/`
2. The gateway imports and exports `Sandbox` from `@cloudflare/sandbox`
3. The Worker has a real Sandbox binding configured in Wrangler
4. The gateway exposes runtime endpoints Webmaker can call
5. The gateway is deployed with `wrangler deploy`
6. The Next.js app is configured to call that deployed gateway

### Required Worker behavior

Your gateway should translate Webmaker runtime actions to Cloudflare Sandbox SDK calls:

| Webmaker runtime action | Cloudflare Sandbox SDK call |
|---|---|
| install dependencies | `sandbox.exec("npm install")` |
| verify build | `sandbox.exec("npm run build")` |
| run command | `sandbox.exec(command)` |
| start preview | `sandbox.startProcess("npm run dev")` |
| preview logs | `sandbox.getProcessLogs(processId)` or `sandbox.streamProcessLogs(processId)` |
| interpreter tasks | `sandbox.createCodeContext()` + `sandbox.runCode()` |
| browser terminal | `sandbox.terminal(request, { cols, rows })` |
| websocket service | `sandbox.wsConnect(request, port)` |

### Files now present in this repo

- `workers/sandbox-gateway/package.json`
- `workers/sandbox-gateway/wrangler.jsonc`
- `workers/sandbox-gateway/Dockerfile`
- `workers/sandbox-gateway/src/index.ts`

### What you still need to do

1. Install worker dependencies:

```bash
npm install --prefix workers/sandbox-gateway
```

2. Authenticate Wrangler:

```bash
npx wrangler login
```

3. Configure worker auth/vars:

- set worker secret `GATEWAY_TOKEN`
- set worker var `SANDBOX_PREVIEW_HOSTNAME`
- optionally adjust:
  - `SANDBOX_SLEEP_AFTER`
  - `SANDBOX_WORKSPACE_ROOT`
  - `SANDBOX_PREVIEW_PORT`

Example:

```bash
npx wrangler secret put GATEWAY_TOKEN
```

4. Deploy the worker:

```bash
npm run sandbox-gateway:deploy
```

5. Configure the Next.js app:

In `.env.local` or your deployment env:

```bash
CLOUDFLARE_SANDBOX_GATEWAY_URL=https://your-worker.your-domain.com
CLOUDFLARE_SANDBOX_GATEWAY_TOKEN=the-same-token-you-set-in-the-worker
```

6. Restart the Next.js app after env changes.

### Verify Cloudflare is really connected

After you deploy the gateway:

1. `wrangler deploy` succeeds
2. the Worker has a live URL
3. calling the gateway status endpoint returns success
4. `/api/health` in Webmaker shows `checks.cloudflareSandboxGateway.ok: true`
5. selecting `cloudflare-sandbox` in Studio and hitting refresh no longer shows a missing gateway error
6. running a runtime action no longer returns a gateway configuration error
7. `runtime.install_dependencies`, `runtime.verify_build`, and `runtime.start_preview` all execute through the Worker

If steps 5-7 fail, Cloudflare is still not connected correctly.

---

## 4. Smoke test after deploy

1. `GET /api/health` — expect `status: "ok"` when OpenRouter + Redis are configured (degraded is OK if Redis skipped).
2. Open `/studio`, send a short prompt — generation should stream.
3. Preview panel uses **StackBlitz** (WebContainers) for in-browser Vite preview; use Code → ZIP for local `npm` / deploy.

---

## 5. Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| 503 on `/api/health` | Missing `OPENROUTER_API_KEY` |
| Generation errors | Key invalid or model id issue — check OpenRouter dashboard |
| Preview link 404 on Vercel | Add Upstash Redis vars |
| `cloudflare-sandbox` selected but runtime says gateway is missing | Set `CLOUDFLARE_SANDBOX_GATEWAY_URL` in the Next.js app |
| gateway returns 401 | `CLOUDFLARE_SANDBOX_GATEWAY_TOKEN` does not match worker secret `GATEWAY_TOKEN` |
| preview start fails on Cloudflare | `SANDBOX_PREVIEW_HOSTNAME` is missing or wildcard DNS/custom domain is not configured |

Local/browser preview still works without Cloudflare. Cloudflare Sandbox only becomes active after the gateway pieces above are added and deployed.
