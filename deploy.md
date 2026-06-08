# Deploy Webmaker on EC2 (Docker)

Webmaker is a Next.js Studio UI. **Generation runs through Hermes** (Python subprocess). **Preview runs through Docker** (Vite dev containers bind-mounted from `.webmaker/workspaces/`).

## Architecture

```text
Browser → Webmaker (port 3000)
              ├─ POST /api/generate → python -m webmaker_bridge (Hermes)
              └─ POST /api/preview/docker → docker run node:20-alpine (Vite)
```

On EC2 you run Webmaker in Docker, mount the host Docker socket for previews, and mount a Hermes checkout for generation.

---

## 1. Launch EC2

Recommended starting point:

| Setting | Value |
|---------|--------|
| AMI | Ubuntu 24.04 LTS |
| Instance type | `t3.large` or larger (preview containers need RAM) |
| Storage | 30 GB+ |
| Security group | TCP **22** (SSH), TCP **3000** (or **80/443** behind nginx) |

---

## 2. Install Docker on the instance

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

docker info
```

Note the docker group GID (used in `docker-compose.yml`):

```bash
getent group docker | cut -d: -f3
```

---

## 3. Clone repositories

```bash
sudo mkdir -p /opt/webmaker
sudo chown $USER:$USER /opt/webmaker
cd /opt/webmaker

git clone <your-webmaker-repo-url> webmaker
git clone <your-hermes-agent-repo-url> hermes-agent
```

---

## 4. Configure Hermes

```bash
cd /opt/webmaker/hermes-agent
python3 -m venv .venv
source .venv/bin/activate
pip install -e .

# Configure model/provider inside Hermes (not in Webmaker)
hermes setup model
# or set provider API keys in Hermes .env / ~/.hermes

# Ensure bundled skills (including frontend-design) are available
hermes skills install official/software-development/frontend-design
# or copy/symlink from hermes-agent/skills/ into ~/.hermes/skills/
```

Every Webmaker generation preloads `software-development/frontend-design` into the
Hermes system prompt (override with `WEBMAKER_HERMES_FRONTEND_SKILL`).

---

## 5. Configure Webmaker environment

```bash
cd /opt/webmaker/webmaker
cp .env.example .env
```

Edit `.env`:

```bash
NEXT_PUBLIC_APP_URL=http://<EC2_PUBLIC_IP>:3000

# Hermes (paths inside docker-compose mounts)
WEBMAKER_HERMES_PATH=/opt/webmaker/hermes-agent
WEBMAKER_HERMES_PYTHON=/opt/webmaker/hermes-agent/.venv/bin/python

# Optional: Hermes profile directory on the host
# WEBMAKER_HERMES_HOME=/home/ubuntu/.hermes

# Docker preview
WEBMAKER_DOCKER_IMAGE=node:20-alpine
DOCKER_SOCKET=/var/run/docker.sock

# Docker group GID from step 2
DOCKER_GID=999

# Optional: Upstash Redis for dashboard sync + shareable preview IDs
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Pull the preview base image once (faster first Studio load):

```bash
docker pull node:20-alpine
```

---

## 6. Build and start

```bash
cd /opt/webmaker/webmaker
docker compose build
docker compose up -d
docker compose logs -f webmaker
```

Open `http://<EC2_PUBLIC_IP>:3000/studio`.

---

## 7. Verify

```bash
curl -s http://localhost:3000/api/health | python3 -m json.tool
curl -s http://localhost:3000/api/preview/docker
```

Expected:

- `checks.hermesBridge.ok: true`
- `checks.dockerPreview.ok: true`
- `/api/preview/docker` → `{"available":true,"image":"node:20-alpine"}`

In Studio: send a prompt, open **Preview**, confirm the iframe loads.

---

## 8. Production hardening (recommended)

### Reverse proxy + TLS (nginx + Let's Encrypt)

Expose port 80/443 instead of 3000 publicly. Example nginx upstream:

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
```

Set `NEXT_PUBLIC_APP_URL=https://your-domain.example`.

### Persist data

Workspaces are stored in the `webmaker-workspaces` Docker volume. Back it up periodically:

```bash
docker run --rm \
  -v webmaker_webmaker-workspaces:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/workspaces-backup.tgz -C /data .
```

### Resource limits

Preview containers use host ports `32768+`. Ensure the security group allows localhost-only access to those ports (default Docker behavior binds to `0.0.0.0` — keep Studio behind a VPN or restrict preview to same-machine use).

### Updates

```bash
cd /opt/webmaker/webmaker
git pull
cd /opt/webmaker/hermes-agent
git pull
source .venv/bin/activate && pip install -e .

cd /opt/webmaker/webmaker
docker compose build --no-cache
docker compose up -d
```

---

## 9. Local development (without Docker for Webmaker)

```bash
cd webmaker
cp .env.example .env.local

export WEBMAKER_HERMES_PATH=../hermes-agent
export WEBMAKER_HERMES_PYTHON=../hermes-agent/.venv/bin/python

npm install
npm run dev
```

Docker is still required on the host for Studio preview (`/api/preview/docker`).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `checks.hermesBridge.ok: false` | Set `WEBMAKER_HERMES_PATH` / `WEBMAKER_HERMES_PYTHON`; verify Hermes venv and model config |
| `checks.dockerPreview.ok: false` | Install Docker; mount `/var/run/docker.sock`; set `DOCKER_GID` |
| Preview permission denied on socket | `sudo usermod -aG docker $USER`, re-login; match `DOCKER_GID` in compose |
| Generation works, preview empty | `docker ps --filter label=webmaker.preview=true`; check `docker compose logs webmaker` |
| Redis 503 on dashboard sync | Optional — set Upstash vars or ignore (localStorage still works) |
