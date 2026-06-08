# Webmaker

AI-assisted frontend studio (Next.js): chat, Docker preview, ZIP export, and shareable preview links.

Generation is handled by **[Hermes](https://github.com/NousResearch/hermes-agent)** — Webmaker is the Studio UI and preview runtime.

## Quick start (local)

```bash
cp .env.example .env.local
# Set WEBMAKER_HERMES_PATH and WEBMAKER_HERMES_PYTHON — see deploy.md

npm install
npm run dev
```

Open [http://localhost:3000/studio](http://localhost:3000/studio).

Requirements:

- **Hermes** — model/provider credentials configured in Hermes itself
- **Docker** — for Studio preview (`docker info` must succeed)

## Verify configuration

```bash
curl -s http://localhost:3000/api/health | jq
curl -s http://localhost:3000/api/preview/docker
```

## Deploy on EC2

See **[deploy.md](./deploy.md)** for Docker Compose deployment on AWS EC2.
