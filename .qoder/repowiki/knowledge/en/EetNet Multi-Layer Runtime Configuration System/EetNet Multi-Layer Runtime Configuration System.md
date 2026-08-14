---
kind: configuration_system
name: EetNet Multi-Layer Runtime Configuration System
category: configuration_system
scope:
    - '**'
source_files:
    - src/runtimeConfig.js
    - api/runtime-config.js
    - .env.example
    - public/eetnet-config.json
    - vercel.json
    - vite.config.js
    - capacitor.config.json
    - server.js
    - src/main.jsx
---

## Overview

The EetNet streaming platform uses a layered runtime configuration system that resolves the backend API base URL at application startup, with distinct sources for development, Vercel serverless deployment, and Capacitor Android builds. The system is centered around `src/runtimeConfig.js` and its companion serverless function `api/runtime-config.js`, with environment variables defined in `.env.example`.

## Configuration Sources and Priority

Configuration resolution follows a strict priority order (highest to lowest), documented in `src/runtimeConfig.js`:

1. **Query parameter override** — `?apiBase=` on the page URL provides a session-only emergency override; it is stripped from the URL bar after reading via `history.replaceState`.
2. **Vercel serverless endpoint** — `/api/runtime-config` reads `process.env.API_BASE`, `process.env.VITE_API_BASE`, or `process.env.PUBLIC_API_BASE` at request time, so changing the env var on Vercel instantly reconfigures all clients without redeploy.
3. **Static JSON fallback** — `public/eetnet-config.json` contains a hardcoded `API_BASE` value (currently a Cloudflare tunnel) used when no serverless config is available.
4. **Build-time env** — `import.meta.env.VITE_API_BASE` baked into the Vite build; localhost values are explicitly stripped when running under `vercel.app`.
5. **Local dev auto-detect** — falls back to `http://localhost:8080` when the browser host is `localhost` or `127.0.0.1`.
6. **Capacitor APK fallback** — if no config resolves inside the native Android WebView, a built-in `FALLBACK_TUNNEL = 'https://saves-included-software-park.trycloudflare.com'` is used.

All resolved values are stored on `window.__EETNET_CONFIG__` as `{ API_BASE }` and consumed via `getApiBase()` / `urlApi(path)` helpers throughout the frontend.

## Backend Configuration

The Express server (`server.js`) reads runtime settings directly from `process.env`:
- `PORT` (default 8080)
- `CORS_ORIGIN` (default `*`)
- `KISSKH_BASE`, `ENCDEC_BASE`, `HIVETOONS_BASE` — provider base URLs
- `ANIMERULZ_FALLBACK`, `ANIMERULZ_DATA`, `ANIMERULZ_ANIMELOK`, `ANIMERULZ_EXTRACT`, `ANIMERULZ_HIANIME` — AnimeRulz endpoints

These are declared in `.env.example` with comments explaining each variable's purpose and default behavior. There is no `.env` committed; the example file documents the full set of required/optional variables.

## Build-Time and Deployment Configuration

- **Vite** (`vite.config.js`): Dev server proxies `/api` to `http://localhost:8080` so mobile/LAN devices can reach the backend without setting `VITE_API_BASE`; also proxies `/anilist-proxy` to Anilist GraphQL.
- **Vercel** (`vercel.json`): Rewrites `/api/runtime-config` to `api/runtime-config.js` and all other `/api/*` routes to `api/index.js` (which exports the Express app from `server.js`). Root and `/index.html` are served with `no-cache, no-store, must-revalidate` headers to ensure fresh config on every load.
- **Capacitor** (`capacitor.config.json`): Configures the Android shell with `appId`, `appName`, splash screen, status bar, keyboard behavior, and `allowMixedContent: true`.
- **Android assets**: A copy of `eetnet-config.json` is embedded under `android/app/src/main/assets/public/` alongside the built web app, serving as the static fallback for the Capacitor APK.

## Conventions and Constraints

- All API base URLs are normalized by stripping trailing slashes via `cleanApiBase()` before use.
- Localhost URLs are rejected when running under `vercel.app` to prevent dev artifacts leaking into production.
- The query param override writes only to `window.__EETNET_CONFIG__` — no `localStorage` is used, avoiding stale URL issues across sessions.
- Fetches to `/api/runtime-config` and `/eetnet-config.json` use cache-busting (`_t=${Date.now()}`) and `cache: 'no-store'` except inside the Capacitor native platform, where local file fetches bypass cache busting.
- The health endpoint (`/api/health`) exposes current config state including provider bases and CORS origin for diagnostics.
- Environment variables are documented inline in `.env.example` with explicit guidance (e.g., "NEVER commit your real .env", separate ports for API vs proxy).