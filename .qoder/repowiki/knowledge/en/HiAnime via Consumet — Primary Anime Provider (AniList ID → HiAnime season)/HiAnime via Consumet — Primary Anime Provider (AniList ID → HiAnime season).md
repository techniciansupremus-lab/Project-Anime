---
kind: external_dependency
name: HiAnime via Consumet — Primary Anime Provider (AniList ID → HiAnime season)
slug: hianime-consumet
category: external_dependency
category_hints:
    - sdk_real_api
scope:
    - '**'
---

Primary anime metadata and episodes are resolved through `@consumet/extensions` using `META.Anilist` wrapping `ANIME.Hianime`. The flow uses AniList IDs to disambiguate seasons deterministically (no title search ambiguity), then maps AniList ID → HiAnime ID → correct season page. A secondary AnimeKai scraper and a last-resort AnimeUnity fallback exist.

- Episode list for HiAnime is cached in-memory keyed by AniList ID with a 30-minute TTL because HiAnime's episode pages can be slow/unstable.
- Jikan (MyAnimeList) is used as a separate cache layer for episode titles, air dates, filler/recap flags via `api.jikan.moe/v4/anime/:malId/episodes?page=N`.