---
kind: external_dependency
name: Vercel — Frontend Hosting & Serverless API Routes
slug: vercel
category: external_dependency
category_hints:
    - vendor_identity
scope:
    - '**'
---

The React + Vite frontend is deployed on Vercel; `vercel.json` rewrites `/api/*` requests to `api/index.js` (serverless functions) and serves the SPA via a catch-all rewrite. The backend Express server (`server.js`) runs separately on an Android phone via Termux and is NOT hosted on Vercel — only the frontend and its own tiny runtime-config endpoint are.

- Build-time env: `VITE_API_BASE` is inlined by Vite at build time, so any change to the ngrok/Cloudflare tunnel URL requires a redeploy.
- Headers: root and `index.html` are forced `no-cache` to avoid stale redirects when the tunnel URL rotates.