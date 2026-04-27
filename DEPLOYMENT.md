# Deploying to AWS Lightsail

This guide walks through setting up the Hoboken Commuter Dashboard on AWS Lightsail with automatic deploys from GitHub.

## Overview

- **Server:** AWS Lightsail **$10/mo** instance (2 vCPU, 2GB RAM, 60GB SSD) — see note below on why 2GB
- **Process manager:** pm2 (keeps the server running, auto-restarts on crash)
- **Auto-deploy:** GitHub Actions — every push to `master` deploys automatically (doc-only pushes skipped)
- **HTTPS:** Caddy (free, auto-renews Let's Encrypt certificates)

> ⚠️ **Use the 2GB RAM plan, not 1GB.** The `npm run build` step during deploys requires significant memory. On a 1GB instance, the build exhausts RAM, the OS kills processes, and the server ends up in a broken state with SSH hanging. 2GB resolves this completely. See DECISIONS.md for full explanation.

---

## Step 1 — Create the Lightsail Instance

1. Go to [lightsail.aws.amazon.com](https://lightsail.aws.amazon.com)
2. Create instance → **Linux/Unix** → **OS Only** → **Ubuntu 24.04 LTS**
3. Choose **$10/mo** plan (2GB RAM) — do not use 1GB, builds will fail
4. Name it `hoboken-commuter`
5. Create a **static IP** and attach it to the instance (free while attached)
6. In the **Networking** tab, open ports: **22** (SSH), **80** (HTTP), **443** (HTTPS)

---

## Step 2 — Initial Server Setup

SSH into your instance (use the Lightsail browser SSH or your own key):

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install pm2 globally
sudo npm install -g pm2

# Install Caddy (web server / reverse proxy with auto-HTTPS)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy -y

# Create app directory
sudo mkdir -p /app
sudo chown $USER:$USER /app
```

---

## Step 3 — Clone and Configure the App

```bash
cd /app
git clone https://github.com/catmeum/hoboken-commuter.git
cd hoboken-commuter

# Install dependencies
npm ci

# Create .env file
cp .env.example .env
nano .env
```

Fill in your `.env`:
```env
VITE_NJT_USERNAME=your_username
VITE_NJT_PASSWORD=your_password
MTA_BUS_API_KEY=your_mta_key
NODE_ENV=production
ALLOWED_ORIGIN=https://yourdomain.com
BUS_API_PORT=3001
```

```bash
# Build the frontend
npm run build

# Create cache directory
mkdir -p .cache
```

---

## Step 4 — Start with pm2

```bash
cd /app/hoboken-commuter

# Start the server with NODE_ENV=production
NODE_ENV=production pm2 start server/index.js --name hoboken-commuter --node-args="--max-old-space-size=1536"

# Save pm2 config so it restarts on reboot
pm2 save
pm2 startup
# Run the command it outputs (looks like: sudo env PATH=... pm2 startup ...)
```

Verify it's running:
```bash
pm2 status
pm2 logs hoboken-commuter --lines 20
```

---

## Step 5 — Configure Caddy (HTTPS + reverse proxy)

Point your domain's DNS A record to your Lightsail static IP first, then:

```bash
sudo nano /etc/caddy/Caddyfile
```

Replace the contents with:
```
yourdomain.com {
    reverse_proxy localhost:3001
}
```

```bash
sudo systemctl reload caddy
```

Caddy automatically obtains and renews a Let's Encrypt certificate. Your app will be live at `https://yourdomain.com` within a minute.

**No domain yet?** You can use the Lightsail static IP directly for now — just skip Caddy and access `http://YOUR_IP:3001`. Add a domain later when ready.

---

## Step 6 — Set Up GitHub Actions Auto-Deploy

In your GitHub repo, go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `LIGHTSAIL_HOST` | Your Lightsail static IP |
| `LIGHTSAIL_USER` | `ubuntu` (default Lightsail user) |
| `LIGHTSAIL_SSH_KEY` | Your Lightsail private SSH key (contents of the `.pem` file) |

To get your SSH key:
1. Lightsail console → Account → SSH keys → Download default key
2. Copy the entire contents of the `.pem` file into the `LIGHTSAIL_SSH_KEY` secret

From now on, every `git push` to `master` will automatically:
1. Build the frontend
2. SSH into your server
3. Pull the latest code
4. Rebuild
5. Restart pm2

---

## Step 7 — Verify

```bash
# Check server is running
pm2 status

# Check logs
pm2 logs hoboken-commuter

# Test the API
curl http://localhost:3001/api/bus/gtfs-status
```

---

## Adding a Second App Later

The beauty of a VPS: just repeat Steps 3-5 for the new app on a different port (e.g. 3002), then add a new block to your Caddyfile:

```
yourdomain.com {
    reverse_proxy localhost:3001
}

otherapp.com {
    reverse_proxy localhost:3002
}
```

Both apps share the same $5/mo instance. Caddy handles HTTPS for both automatically.

---

## Useful Commands

```bash
# View live logs
pm2 logs hoboken-commuter

# Restart server
pm2 restart hoboken-commuter

# Check GTFS cache status
curl http://localhost:3001/api/bus/gtfs-status

# Manual deploy (if GitHub Actions isn't set up yet)
cd /app/hoboken-commuter && git pull && npm ci && npm run build && pm2 restart hoboken-commuter

# Update Node.js or npm packages
npm ci && pm2 restart hoboken-commuter
```

---

## Environment Variables Reference

| Variable | Description | Required |
|---|---|---|
| `VITE_NJT_USERNAME` | NJ Transit developer username | Yes |
| `VITE_NJT_PASSWORD` | NJ Transit developer password | Yes |
| `MTA_BUS_API_KEY` | MTA Bus Time API key | Yes (for MTA Bus) |
| `NODE_ENV` | Set to `production` on server | Yes |
| `ALLOWED_ORIGIN` | Your domain (e.g. `https://yourdomain.com`) | Recommended |
| `BUS_API_PORT` | Server port (default: 3001) | No |

---

## Known Issues & Gotchas

### Use 2GB RAM — 1GB is not enough
The 1GB Lightsail plan causes SSH to hang and the service to fail continuously during deploys. The root cause is `npm run build` exhausting available RAM, causing the OS to kill processes mid-deploy. Symptoms: GitHub Actions SSH step hangs indefinitely, pm2 shows the app as errored, server becomes unresponsive.

**Fix:** Use the $10/mo 2GB plan. The extra $5/mo is worth it — 1GB is simply not viable for a Node.js app that builds on the server.

### Express 5 wildcard routes require named parameters
Express 5 (used in this project) uses `path-to-regexp` v8 which no longer accepts unnamed wildcards. Any route using `/*` will throw at startup in production.

**Fix:** rename all wildcards:
```js
// ❌ Express 4 style — breaks in Express 5
app.get('/api/panynj/*', ...)
app.get('*', ...)

// ✅ Express 5 style
app.get('/api/panynj/*path', ...)
app.get('*path', ...)
```
This only affects production because in dev, Vite handles `/api/panynj/*` and `/api/nws/*` via its own proxy — Express never sees those routes.

### NODE_ENV must be set explicitly for production mode
The server checks `process.env.NODE_ENV === 'production'` to enable static file serving and the PANYNJ/NWS proxy routes. If this isn't set, the server starts but serves no frontend and tunnels/weather won't work.

Set it in the pm2 start command:
```bash
NODE_ENV=production pm2 start server/index.js --name hoboken-commuter
```
Or in a pm2 ecosystem file, or as a system environment variable.

### API routes must be registered before the production catch-all
In production mode, Express serves the React SPA via a `*path` catch-all that returns `index.html` for any unmatched path. Any `app.get('/api/...')` route registered **after** this catch-all will return HTML instead of JSON.

All API endpoints must be defined before the `if (process.env.NODE_ENV === 'production')` block in `server/index.js`.

### Ubuntu version
Use Ubuntu 24.04 LTS for new instances (supported until 2029). The initial setup used 22.04 — both work fine with Node 20, but 24.04 is preferred going forward.
