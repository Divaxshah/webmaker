# Webmaker

AI-assisted frontend studio (Next.js): chat, browser preview, ZIP/export and shareable preview (`/api/preview`).

## Quick start (local)

```bash
cp .env.example .env.local
# Set OPENROUTER_API_KEY at minimum — see DEPLOY.md

npm install
npm run dev
```

Open [http://localhost:3000/studio](http://localhost:3000/studio).

## Verify configuration

After setting env vars:

```bash
curl -s http://localhost:3000/api/health | jq
```

- **`OPENROUTER_API_KEY`** — required for generation.
- **Cloudflare Sandbox + Redis** — optional; see **[DEPLOY.md](./DEPLOY.md)** for production.

## Cloudflare Sandbox status

The Studio now has a runtime provider selector with:

- `local`
- `cloudflare-sandbox`

This repo now includes the Cloudflare gateway scaffold at `workers/sandbox-gateway/`.

What is already done:

- `workers/sandbox-gateway/package.json`
- `workers/sandbox-gateway/wrangler.jsonc`
- `workers/sandbox-gateway/Dockerfile`
- `workers/sandbox-gateway/src/index.ts`
- root scripts:
  - `npm run sandbox-gateway:dev`
  - `npm run sandbox-gateway:deploy`
- Next.js runtime calls the gateway when `cloudflare-sandbox` is selected

What is still on you:

- install worker dependencies
- configure Wrangler auth and Sandbox binding in your Cloudflare account
- set the worker secrets/vars
- deploy the worker
- set the Next.js app env vars to the deployed gateway URL/token

Until you deploy and configure those pieces, use `local` for actual runtime execution.

## Deploy

Follow **[DEPLOY.md](./DEPLOY.md)** end-to-end.

---

This repo was bootstrapped with `create-next-app`; Next.js docs live at [nextjs.org/docs](https://nextjs.org/docs).
