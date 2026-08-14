---
kind: external_dependency
name: MoviePlex — Movie/Drama Catalog + LuluStream/StreamTape Stream Extraction
slug: movieplex
category: external_dependency
category_hints:
    - framework_behavior
scope:
    - '**'
---

The movies section currently uses MoviePlex (`movieplex.co.in`) as its sole provider. Catalog comes from WordPress REST API (`/wp-json/wp/v2/`) with 14 category mappings, paginated at 100 posts/page and cached in memory, rebuilt every 24 hours. Thumbnails are lazy-loaded via a post-info scrape.

Stream extraction chains multiple providers:
2. StreamTape — regex-based token concatenation for split MP4 tokens.
3. Original iframe fallback when extraction fails.

Streams are never cached (expiry tokens); only the catalog is cached. Protected CDNs like `tnmr.org` block non-browser User-Agents and reject requests containing `Accept-Language` header.