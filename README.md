# AniStream

A Netflix-style streaming aggregator for **anime, Asian dramas, and manhwa (webtoons)**.

- **Frontend:** React + Vite, deployed on **Vercel**.
- **Backend:** Node.js / Express scraper + stream proxy, runs on an **Android phone via Termux**, exposed to the internet through a public tunnel (**ngrok** for now).

The frontend talks to the backend over HTTP using the `VITE_API_BASE` env var — there is no shared deployment and **Railway is not used**.

```
 Browser (Vercel)  ──►  https://<ngrok>.ngrok-free.app/api/...  ──►  phone (Termux)
                                                                      ├─ node server.js   (port 8080)
                                                                      ├─ proxy.py         (relay → kisskh.co)
                                                                      └─ ngrok            (public tunnel)
```

## Prerequisites
- Node.js 18+ (on the phone via Termux, and locally for dev)
- A free [ngrok](https://ngrok.com) account (authtoken) — or any public tunnel
- A Vercel account for the frontend

---

## 1. Backend on the phone (Termux)

Open Termux and install the runtime + relay:

```bash
pkg update && pkg upgrade -y
pkg install nodejs python -y
termux-wake-lock
```

### a) Relay proxy (`proxy.py`)
KissKH/Cloudflare block datacenter/cloud IPs, so the backend must reach KissKH
from the phone's residential IP. `proxy.py` is a tiny local proxy that forwards
`/api/*` to `https://kisskh.co`. Save it next to `server.js` and run:

```bash
python proxy.py
```

Keep this running (Session 1).

### b) Public tunnel (ngrok)
In a second Termux session:

```bash
curl -L https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz -o ngrok.tgz
tar -xzf ngrok.tgz
./ngrok config add-authtoken <YOUR_NGROK_TOKEN>
./ngrok http 8080
```

Copy the printed `https://….ngrok-free.app` URL — the frontend needs it.

### c) Start the API server
In a third Termux session (or backgrounded):

```bash
node server.js
```

`server.js` listens on `PORT` (default **8080**) and enables CORS for the
frontend. The full phone chain is: **`proxy.py` → `ngrok` → `node server.js`**,
all on port 8080.

### Backend env vars
| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8080` | Listen port (must match `proxy.py` + ngrok target) |
| `CORS_ORIGIN` | `*` | Allowed frontend origin (`*` or your Vercel URL) |
| `KISSKH_BASE` | `https://kisskh.co` | Override to a relay URL when KissKH blocks the backend's IP |
| `ENCDEC_BASE` | `https://enc-dec.app` | Override only if enc-dec.app also blocks the backend's IP |

---

## 2. Frontend on Vercel

Build and deploy:

```bash
npm install
npm run build      # outputs dist/ (picked up by Vercel)
```

In the **Vercel project settings → Environment Variables**, set:

```
VITE_API_BASE = https://<your-ngrok-url>.ngrok-free.app
```

Then deploy (Vercel Git integration, or `npx vercel --prod`).

> ⚠️ **Vite inlines `VITE_API_BASE` at build time.** A free ngrok URL rotates
> every time ngrok restarts, so whenever the URL changes you must update
> `VITE_API_BASE` on Vercel and **redeploy the frontend**. For a permanent URL,
> use a **named Cloudflare Tunnel** (custom domain) instead of ngrok.

---

## 3. Local development

```bash
# Terminal 1 — backend (locally, or point VITE_API_BASE at your phone's ngrok URL)
node server.js

# Terminal 2 — frontend
npm install
npm run dev
```

Create a local `.env` (see `.env.example`) to override the API base if needed:

```bash
VITE_API_BASE=http://localhost:8080
```

With no `.env`, the frontend defaults to `http://localhost:8080`.

---

## Environment variable reference

| Variable | Where | Default | Notes |
|----------|-------|---------|-------|
| `VITE_API_BASE` | Frontend (Vercel / `.env`) | `http://localhost:8080` | Backend origin; no trailing slash. Baked in at build time. |
| `PORT` | Backend | `8080` | Listen port. |
| `CORS_ORIGIN` | Backend | `*` | Allowed frontend origin. |
| `KISSKH_BASE` | Backend | `https://kisskh.co` | Relay URL when KissKH blocks the backend IP. |
| `ENCDEC_BASE` | Backend | `https://enc-dec.app` | Relay URL for the kkey service if needed. |

---

## How the streaming proxy works
The backend rewrites HLS `.m3u8` manifests and `.ts` segments through
`/api/m3u8-proxy` and `/api/ts-proxy` so the browser only ever talks to the
backend's public URL (no mixed-content, no CORS issues with the video CDN).
The public host used in those rewritten URLs is derived from `X-Forwarded-*`
headers, so it stays `https://` behind ngrok.

## Troubleshooting
- **Drama/manhwa empty on the site:** the backend is down, or `VITE_API_BASE`
  on Vercel points at a stale ngrok URL. Restart the phone chain and redeploy
  the frontend with the current URL.
- **Video won't play but metadata loads:** the video CDN may also block the
  backend's IP — route the video through the same relay as KissKH.
- **403 from the tunnel:** your tunnel provider is challenging the Vercel
  (datacenter) IP. Use a tunnel without Cloudflare-edge challenges, or a named
  Cloudflare Tunnel with Bot Fight Mode off.
