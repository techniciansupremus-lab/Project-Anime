---
kind: external_dependency
name: ngrok — Temporary Public Tunnel for Phone-Hosted Backend
slug: ngrok
category: external_dependency
category_hints:
    - client_constraint
scope:
    - '**'
---

The backend runs on an Android phone via Termux on port 8080 and is exposed to the internet through ngrok v3 (`ngrok http 8080`). The resulting `https://....ngrok-free.app` URL is set as `VITE_API_BASE` on Vercel.

- Free ngrok URLs rotate on restart; whenever the URL changes, `VITE_API_BASE` must be updated in Vercel settings and the frontend redeployed because Vite inlines it at build time.
- The README recommends a named Cloudflare Tunnel with a custom domain for a permanent URL.