---
kind: external_dependency
name: KissKH — Drama Stream Source (with optional residential IP relay)
slug: kisskh
category: external_dependency
category_hints:
    - client_constraint
scope:
    - '**'
---

Drama content is sourced from KissKH. The backend scrapes KissKH directly unless datacenter/cloud IPs are blocked, in which case `proxy.py` (Python HTTP proxy on a separate port, default 9090) relays requests through the phone's residential IP. `KISSKH_BASE` points either at `https://kisskh.co` or at the local relay.

- `proxy.py` must run on a different port than the API server (8080); if both bind 8080, ngrok tunnels the proxy instead of the API and all routes return KissKH HTML.
- The relay forwards headers and strips `transfer-encoding`/`connection` before passing them upstream.