---
kind: external_dependency
name: NetMirror — Planned Multi-OTT Aggregator (Research Phase, Not Yet Integrated)
slug: netmirror
category: external_dependency
category_hints:
    - migration_status
scope:
    - '**'
---

NetMirror research documents a complete integration plan for movies/dramas/anime/OTT aggregation via `net52.cc` (rotating mirror domains). The auth bypass uses `POST /verify.php` with a random UUID as `g-recaptcha-response`, returning a `t_hash_t` cookie valid ~72 hours. Streaming uses self-hosted HLS CDN at `nm-cdnN.top` with `?in=` resource keys.

- Status: Research complete, code stubs present in `server.js` (`getNetmirrorToken`, `fetchStreamProxyTarget` NetMirror branch), but full routes (`/api/netmirror/*`) are not yet implemented — still in the research/planning phase.
- Domain rotation is expected; Telegram channel `t.me/netmirror_app` tracks updates.
- If integrated, would use the existing `m3u8-proxy`/`ts-proxy` pipeline with spoofed Origin/Referer.