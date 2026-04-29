# Webmaker

AI-assisted frontend studio (Next.js): chat, Sandpack preview, optional Cloudflare Sandbox for real installs/dev preview.

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
- **Sandbox + Redis** — optional; see **[DEPLOY.md](./DEPLOY.md)** for production.

## Deploy

Follow **[DEPLOY.md](./DEPLOY.md)** end-to-end (OpenRouter → optional Upstash → optional Sandbox Worker).

### Sandbox Worker only

```bash
npm run sandbox-gateway:deploy
```

This installs deps under `workers/sandbox-gateway` and runs `wrangler deploy`.

---

This repo was bootstrapped with `create-next-app`; Next.js docs live at [nextjs.org/docs](https://nextjs.org/docs).
