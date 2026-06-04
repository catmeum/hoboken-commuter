# Deploying to AWS Lightsail

This guide walks through setting up My Stop Now on AWS Lightsail with automatic deploys from GitHub.

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
4. Name it `my-stop-now`
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
git clone https://github.com/catmeum/hoboken-commuter.git my-stop-now
cd my-stop-now

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
ALLOWED_ORIGIN=https://mystopnow.com
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

The server uses a PM2 ecosystem file for configuration, including a scheduled restart every 3 days to refresh NJT GTFS static data (required by NJT's license terms).

Create `ecosystem.config.cjs` in `/app/my-stop-now/`:

```js
module.exports = {
  apps: [{
    name: 'my-stop-now',
    script: 'server/index.js',
    node_args: '--max-old-space-size=1536',
    env: { NODE_ENV: 'production' },
    cron_restart: '0 3 */3 * *'  // Restart at 3am every 3 days to refresh GTFS cache
  }]
}
```

Start (or switch over from an inline pm2 start):

```bash
cd /app/my-stop-now

# If already running via inline command, stop it first:
pm2 stop my-stop-now
pm2 delete my-stop-now

# Start using ecosystem file
pm2 start ecosystem.config.cjs

# Save pm2 config so it restarts on reboot
pm2 save
pm2 startup
# Run the command it outputs (looks like: sudo env PATH=... pm2 startup ...)
```

Verify it's running:
```bash
pm2 status
pm2 logs my-stop-now --lines 20
```

> **Why the cron restart?** The `loadGTFS()` function in `server/index.js` checks the age of `.cache/gtfs.zip` on startup and re-downloads if it's older than 3 days. Without periodic restarts, a long-running server would never trigger a re-download.

---

## DNS Configuration

All domains must have DNS A records pointing to the Lightsail static IP address. Set these up in your domain registrar's DNS management panel before configuring Caddy.

| Domain | Record Type | Value | Purpose |
|--------|-------------|-------|---------|
| `mystopnow.com` | A | `<Lightsail static IP>` | Production app |
| `www.mystopnow.com` | A | `<Lightsail static IP>` | www → non-www redirect |
| `beta.mystopnow.com` | A | `<Lightsail static IP>` | Beta/staging environment |
| `commute.stroszeck.com` | A | `<Lightsail static IP>` | Legacy domain redirect |

> ⚠️ **commute.stroszeck.com must remain pointed at the Lightsail IP.** This domain redirects to mystopnow.com via Caddy. If the DNS record is removed, existing bookmarks and cached links to the old domain will break. Keep this record indefinitely.

All four domains are served by the same Lightsail instance. Ports **80** (HTTP) and **443** (HTTPS) must be open in the Lightsail Networking tab for Caddy to obtain Let's Encrypt certificates and serve traffic for all domains.

---

## Step 5 — Configure Caddy (HTTPS + reverse proxy)

Point all domain DNS A records to your Lightsail static IP first (see [DNS Configuration](#dns-configuration) above), then:

```bash
sudo nano /etc/caddy/Caddyfile
```

Replace the contents with the full Caddyfile:

```caddy
# Production — main application
mystopnow.com {
    reverse_proxy localhost:3001
}

# www redirect — canonical non-www domain
www.mystopnow.com {
    redir https://mystopnow.com{uri} permanent
}

# Beta — pre-production staging environment
beta.mystopnow.com {
    reverse_proxy localhost:3002
}

# Legacy redirect — old domain preserves path + query string
commute.stroszeck.com {
    redir https://mystopnow.com{uri} permanent
}
```

```bash
sudo systemctl reload caddy
```

**How this works:**

- Caddy automatically obtains and renews Let's Encrypt HTTPS certificates for all four domains
- HTTP requests (port 80) are automatically redirected to HTTPS (port 443) by Caddy
- `{uri}` preserves the full path and query string in redirects (e.g., `/mobile?foo=bar` stays intact)
- `permanent` means HTTP 301 — browsers cache this redirect permanently
- `mystopnow.com` and `beta.mystopnow.com` reverse-proxy to separate Express processes (ports 3001 and 3002)
- `www.mystopnow.com` and `commute.stroszeck.com` both 301 redirect to `mystopnow.com` with path preserved

**No domain yet?** You can use the Lightsail static IP directly for now — just skip Caddy and access `http://YOUR_IP:3001`. Add domains later when ready.

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
pm2 logs my-stop-now

# Test the API
curl http://localhost:3001/api/bus/gtfs-status
```

---

## Beta Stage Setup

Beta runs as a fully independent clone at `beta.mystopnow.com`, isolated from production.

### Directory Structure

```
/app/
├── my-stop-now/              # Production (port 3001)
├── my-stop-now-beta/         # Beta (port 3002)
└── my-stop-now-backup/       # Timestamped rollback backups
```

### Initial Beta Setup

```bash
cd /app
git clone https://github.com/catmeum/hoboken-commuter.git my-stop-now-beta
cd my-stop-now-beta
git checkout beta
npm ci

# Create beta .env (differs from production)
cp .env.example .env
nano .env
```

Beta `.env` — key differences from production:
```env
VITE_NJT_USERNAME=your_username
VITE_NJT_PASSWORD=your_password
MTA_BUS_API_KEY=your_mta_key
NODE_ENV=production
ALLOWED_ORIGIN=https://beta.mystopnow.com
BUS_API_PORT=3002
```

> The critical difference: `ALLOWED_ORIGIN=https://beta.mystopnow.com` and `BUS_API_PORT=3002`.

```bash
# Build
npm run build
mkdir -p .cache

# Start as separate pm2 process
NODE_ENV=production pm2 start server/index.js --name my-stop-now-beta --node-args="--max-old-space-size=1536"
pm2 save
```

### Verify Beta

```bash
pm2 status
# Should show both: my-stop-now (port 3001) and my-stop-now-beta (port 3002)

curl http://localhost:3002/api/bus/gtfs-status
# Should return 200 with GTFS status JSON
```

Caddy already has the `beta.mystopnow.com` block (see Step 5) reverse-proxying to port 3002.

---

## ALLOWED_ORIGIN Configuration

The `ALLOWED_ORIGIN` environment variable controls CORS — it determines which browser origin is allowed to make API requests.

| Environment | ALLOWED_ORIGIN value |
|-------------|---------------------|
| Production | `https://mystopnow.com` |
| Beta | `https://beta.mystopnow.com` |
| Unset | Falls back to `Access-Control-Allow-Origin: *` (permissive) |

### Updating ALLOWED_ORIGIN

To change the allowed origin (e.g., when setting up a new domain):

```bash
# Edit the .env in the relevant app directory
nano /app/my-stop-now/.env      # for production
nano /app/my-stop-now-beta/.env # for beta

# Change the line:
# ALLOWED_ORIGIN=https://mystopnow.com

# Then restart the pm2 process for changes to take effect:
pm2 restart my-stop-now        # for production
pm2 restart my-stop-now-beta   # for beta
```

> ⚠️ If ALLOWED_ORIGIN doesn't match the domain users access the site from, the browser will block all API calls. The app will appear to load but show no transit data.

---

## Rollback Procedure

If a deploy introduces issues, restore service from the timestamped backup. Target: **restore service within 5 minutes**.

### Steps

```bash
# 1. Stop the broken pm2 process
pm2 stop my-stop-now

# 2. Identify the latest backup
ls /app/my-stop-now-backup/
# Example output: 20250101-120000  20250115-143022

# 3. Restore files from the latest backup
BACKUP="/app/my-stop-now-backup/20250115-143022"  # use actual latest timestamp
cp -r "$BACKUP/dist/" /app/my-stop-now/dist/
cp "$BACKUP/server/index.js" /app/my-stop-now/server/index.js
cp "$BACKUP/package-lock.json" /app/my-stop-now/package-lock.json
cp "$BACKUP/.env" /app/my-stop-now/.env

# 4. Reinstall dependencies if package-lock changed
cd /app/my-stop-now
npm ci

# 5. Restart pm2
pm2 restart my-stop-now

# 6. Verify health endpoint returns 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/bus/gtfs-status
# Should print: 200

# 7. Confirm pm2 shows "online"
pm2 status
```

### For Beta Rollback

Same procedure but target `/app/my-stop-now-beta/` and pm2 process `my-stop-now-beta`.

### When to Remove Backups

Backups are eligible for removal after the new deployment has run for **7 consecutive days** without a manual restart or rollback:

```bash
rm -rf /app/my-stop-now-backup/20250101-120000
```

---

## CI/CD Strategy

### Git Branching

| Branch | Environment | URL | Deploy target |
|--------|-------------|-----|---------------|
| `master` | Production | mystopnow.com | `/app/my-stop-now/` (port 3001) |
| `beta` | Staging | beta.mystopnow.com | `/app/my-stop-now-beta/` (port 3002) |

All development work targets the `beta` branch first. Once validated on staging, changes are promoted to production via either a merge into `master` or the `workflow_dispatch` promote action.

### File-Path Boundaries (Deploy Targets)

The GitHub Actions workflow inspects which files changed to determine the minimum deployment scope:

| Changed paths | Build scope | pm2 restart? |
|---------------|-------------|--------------|
| `src/mobile/**` | Mobile only (`dist/mobile/`) | No |
| `src/**` (excluding `src/mobile/`) | Desktop only (`dist/dashboard/`) | No |
| `server/**`, `package.json`, `package-lock.json`, `vite.config.*` | Full (both builds) | Yes |
| `**.md`, `public/icon-drafts*.html`, `.gitignore` | Skip deployment entirely | — |

When a push touches files from multiple categories, the broadest scope wins (e.g., mobile + server changes → full deploy with pm2 restart).

### Promotion Workflow

Two mechanisms to promote beta → production:

1. **Merge `beta` into `master`** — standard git merge triggers a deploy to production via the push-to-master workflow. Best for batching multiple beta-validated changes.

2. **`workflow_dispatch` with `promote-beta-to-prod`** — manually triggered from the GitHub Actions UI. Copies the current beta build artifacts directly to the production directory. Best for promoting a single validated change without creating a merge commit.

Both approaches deploy the same code; the choice is a matter of git history preference.

### Rationale & Alternatives Considered

**Chosen approach: Two-branch (master/beta) with path-based selective deploys.**

This gives us a real staging environment, independent interface builds, and minimal server restarts — all within the constraints of a single 2GB Lightsail instance.

#### Alternative 1: Single branch with tags

Tag a commit on `master` to trigger production deploys; no separate branch.

- ✅ Simpler git history (linear)
- ❌ No staging environment — changes go directly to production with no pre-production validation
- ❌ Harder to test domain-specific config (ALLOWED_ORIGIN, port) before it's live

Rejected because pre-production validation on beta.mystopnow.com is a hard requirement for this project's deploy safety.

#### Alternative 2: Docker containers per interface

Run separate containers for desktop and mobile, each with their own Express process and build.

- ✅ Full isolation between interfaces
- ✅ Independent scaling and resource limits
- ❌ Overkill for a 2GB instance — Docker overhead (images, networking, orchestration) consumes memory needed for builds
- ❌ Adds operational complexity (compose files, image builds, registry) for a solo-developer project

Rejected because the instance has exactly enough RAM for `npm run build`; adding Docker's memory overhead would recreate the OOM issues we had on the 1GB plan.

#### Alternative 3: Separate repos per interface

Split mobile and desktop into their own repositories, each with independent CI/CD.

- ✅ Maximum independence — each repo owns its own deploy lifecycle
- ❌ Shared code (`src/components/`, `src/services/`) would need to be extracted into an npm package
- ❌ Server changes require coordinated deploys across repos
- ❌ Dramatically increases maintenance burden for a single developer

Rejected because the shared Express backend and common components make a monorepo with path-based selective deploys far simpler to maintain.

### Backup Retention Policy

Backups created by the deploy workflow (in `/app/my-stop-now-backup/`) are **eligible for removal after 7 consecutive days** without a manual pm2 restart or rollback against that backup.

Criteria for removal:
- The deployment that replaced the backup has been running for ≥ 7 days
- No `pm2 restart` was manually triggered during that period (automated restarts from deploys don't count)
- No rollback to that backup was performed

```bash
# Check how long the current deploy has been up
pm2 show my-stop-now | grep uptime

# Remove an old backup once criteria are met
rm -rf /app/my-stop-now-backup/20250101-120000
```

---

## Adding Another App Later

The beauty of a VPS: just repeat Steps 3-5 for the new app on a different port (e.g. 3003), then add a new block to your Caddyfile:

```caddy
otherapp.com {
    reverse_proxy localhost:3003
}
```

All apps share the same $10/mo instance. Caddy handles HTTPS for all of them automatically.

---

## Useful Commands

```bash
# View live logs
pm2 logs my-stop-now

# Restart server
pm2 restart my-stop-now

# Check GTFS cache status
curl http://localhost:3001/api/bus/gtfs-status

# Manual deploy (if GitHub Actions isn't set up yet)
cd /app/my-stop-now && git pull && npm ci && npm run build && pm2 restart my-stop-now

# Update Node.js or npm packages
npm ci && pm2 restart my-stop-now
```

---

## Environment Variables Reference

| Variable | Description | Required |
|---|---|---|
| `VITE_NJT_USERNAME` | NJ Transit developer username | Yes |
| `VITE_NJT_PASSWORD` | NJ Transit developer password | Yes |
| `MTA_BUS_API_KEY` | MTA Bus Time API key | Yes (for MTA Bus) |
| `NODE_ENV` | Set to `production` on server | Yes |
| `ALLOWED_ORIGIN` | Your domain (e.g. `https://mystopnow.com`) | Recommended |
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
NODE_ENV=production pm2 start server/index.js --name my-stop-now
```
Or in a pm2 ecosystem file, or as a system environment variable.

### API routes must be registered before the production catch-all
In production mode, Express serves the React SPA via a `*path` catch-all that returns `index.html` for any unmatched path. Any `app.get('/api/...')` route registered **after** this catch-all will return HTML instead of JSON.

All API endpoints must be defined before the `if (process.env.NODE_ENV === 'production')` block in `server/index.js`.

### Ubuntu version
Use Ubuntu 24.04 LTS for new instances (supported until 2029). The initial setup used 22.04 — both work fine with Node 20, but 24.04 is preferred going forward.
