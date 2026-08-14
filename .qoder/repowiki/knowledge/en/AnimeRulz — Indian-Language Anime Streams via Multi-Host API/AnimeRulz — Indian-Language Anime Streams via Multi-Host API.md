---
kind: external_dependency
name: AnimeRulz — Indian-Language Anime Streams via Multi-Host API
slug: animerulz
category: external_dependency
category_hints:
    - client_constraint
scope:
    - '**'
---

Hindi/Tamil/Telugu/Malayalam/Kannada/Bengali/Japanese/English dubbed anime streams come from the AnimeRulz ecosystem, split across several hosts:
- `ANIMERULZ_DATA` (catalog/dub list)
- `ANIMERULZ_FALLBACK` (episode lists, servers/sources)
- `ANIMERULZ_ANIMELOK` (multi-URL per episode)
- `ANIMERULZ_EXTRACT` (language-track resolution)
- `ANIMERULZ_HIANIME` (metadata)

All endpoints require browser-like `Referer`/`Origin` headers pointing at `animerulzapp.buzz`; without them they return 403. The backend caches catalog/detail/episode/stream responses in memory with TTLs and resolves multi-season animelok IDs by absolute episode range.

- For protected HLS from `streamindia.co.in` / `as-cdn*.top`, the proxy adds `Sec-Fetch-*` headers and retries with alternate referers on 401/403/429/502.