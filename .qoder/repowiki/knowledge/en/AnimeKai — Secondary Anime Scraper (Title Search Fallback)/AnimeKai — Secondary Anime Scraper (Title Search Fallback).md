---
kind: external_dependency
name: AnimeKai — Secondary Anime Scraper (Title Search Fallback)
slug: animekai
category: external_dependency
category_hints:
    - client_constraint
scope:
    - '**'
---

When HiAnime/AniList fails, the backend scrapes `anikai.cc` using Cheerio. It searches by title (optionally season-qualified), scores results with a custom `titleMatchScore` that penalizes sequels when the query does not specify one, then extracts embed URLs per language group (sub/dub/hsub).

- Requires a real browser `User-Agent` and `Referer` set to `anikai.cc`; SSL verification is disabled globally (`NODE_TLS_REJECT_UNAUTHORIZED=0`) specifically to reach `anikai.cc`.
- Embed pages may contain packed JS that resolves to `.m3u8` URLs, extracted via regex.