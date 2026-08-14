---
kind: external_dependency
name: Supabase — Optional Cloud Auth & Watch History Sync
slug: supabase
category: external_dependency
category_hints:
    - client_constraint
scope:
    - '**'
---

Frontend uses `@supabase/supabase-js` with a custom storage adapter that bridges Capacitor Preferences and localStorage. When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not configured, the client falls back to a mock no-op client that returns empty sessions and no-op auth calls — watch history and watchlist remain local-only. With credentials set, it enables cloud-synced watch history plus Google/Discord social login via Supabase OAuth.

- Storage adapter: `customAuthStorage` reads/writes through `utils/storage`, which persists under Capacitor Preferences on Android.
- Token refresh and session persistence are enabled via `autoRefreshToken` and `persistSession`.