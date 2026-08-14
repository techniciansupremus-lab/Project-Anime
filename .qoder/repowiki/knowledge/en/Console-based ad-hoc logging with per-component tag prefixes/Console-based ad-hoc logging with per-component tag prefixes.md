---
kind: logging_system
name: Console-based ad-hoc logging with per-component tag prefixes
category: logging_system
scope:
    - '**'
source_files:
    - server.js
    - api/index.js
    - proxy.py
    - server_log.txt
---

## What system/approach is used

The repository has **no dedicated logging framework or library**. All output goes through Node.js `console` (`console.log`, `console.warn`, `console.error`) and, in the Python helper `proxy.py`, through `print`. There is no structured logger, no log-level configuration, no centralized sink, and no transport (file, syslog, APM). The only persistent artifact is a static startup banner written to `server_log.txt` at process start.

## Key files and packages

- `server.js` — the Express backend; contains every production log statement. Uses tagged prefix strings such as `[M3U8-PROXY]`, `[TS-PROXY]`, `[SUBTITLE-PROXY]`, `[IMAGE PROXY WARNING]`, `[EXTRACT]`, `[ANIMEKAI]`, `[JIKAN]`, `[ANIMERULZ]`, `[NetMirror]` to identify the subsystem that emitted the line.
- `api/index.js` — re-exports the Express app for Vercel serverless; no logging of its own.
- `proxy.py` — a small Python HTTP relay for KissKH; suppresses the default `BaseHTTPRequestHandler.log_message` by overriding it to `pass`, so only the initial `print(f'[proxy.py] ...')` line appears on stdout.
- `server_log.txt` — a one-time startup banner file (written elsewhere) listing service endpoints; not rotated or appended to during runtime.

## Architecture and conventions

1. **Tagged console calls** — Every meaningful log line starts with a bracketed tag identifying the module/feature: e.g. `[M3U8-PROXY] Error: ...`, `[ANIMEKAI] Searching: "..."`, `[JIKAN] Cache hit: ...`. This is the de facto correlation mechanism since there is no request ID or structured context object.
2. **Level usage is informal but consistent**: `console.error` is reserved for failures (upstream fetch errors, proxy errors, Jikan failures); `console.warn` is used for recoverable problems (missing NetMirror token, failed image fetch, missing subtitle URL, AnimeRulz catalogue miss); `console.log` carries operational traces (cache hits, successful stream resolution, search queries, scored results).
3. **No central logger module** — Each route handler and helper function emits logs inline. There is no shared `logger.js` or middleware that wraps requests.
4. **No log rotation or structured fields** — Logs are plain text lines; there is no JSON envelope, no timestamp field (timestamps come from the process), no request ID, no user/session context attached.
5. **Python side silences its own access logs** — `proxy.py` overrides `log_message` to `pass` to avoid noisy per-request logs from `BaseHTTPRequestHandler`; only the startup banner prints.
6. **Frontend has no logging** — The React/Vite frontend under `src/` does not call `console.*` in any of the scanned feature/component files; all diagnostics live in the backend.
7. **Startup banner** — On boot the server writes a human-readable endpoint list into `server_log.txt` (UTF-16 encoded based on the file content), which serves as a static API contract dump rather than a live log.

## Conventions and constraints

- **Convention observed**: Prefix every log message with a `[TAG]` label matching the subsystem (e.g. `[M3U8-PROXY]`, `[ANIMEKAI]`, `[JIKAN]`, `[ANIMERULZ]`, `[EXTRACT]`, `[IMAGE PROXY WARNING]`). This is the only cross-cutting convention enforced by code style.
- **Constraint observed**: External HTTP errors are always logged via `console.error` before returning a 502 response, ensuring failures are visible even when the client receives an error status.
- **Constraint observed**: The Python proxy explicitly disables its built-in request logger (`def log_message(self, *a): pass`) so that only intentional `print` statements appear in its output.
- **Not present**: No environment variable controls log verbosity; no ability to disable debug traces like `[ANIMEKAI] Scored results:` or `[EXTRACT] Fetching player page:`; no structured log format; no log shipping to a collector.