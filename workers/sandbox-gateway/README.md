# Webmaker Sandbox Gateway

Cloudflare Worker running the [Sandbox SDK](https://developers.cloudflare.com/sandbox/). Next.js talks to it over HTTPS — see **`../../DEPLOY.md`** for full deployment order.

## Quick commands

```bash
npm install
npx wrangler secret put SANDBOX_API_SECRET
# Edit wrangler.toml [vars] SANDBOX_PREVIEW_HOSTNAME (real hostname + wildcard DNS)
npm run deploy
```

Production checklist variables:

| Worker (`wrangler` / dashboard) | Webmaker app |
|---------------------------------|--------------|
| `SANDBOX_PREVIEW_HOSTNAME` | — |
| `SANDBOX_API_SECRET` | Same value as `SANDBOX_GATEWAY_SECRET` |
| Worker HTTPS URL | `SANDBOX_GATEWAY_URL` |
