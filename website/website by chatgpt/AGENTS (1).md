# AGENTS.md — EetNet (Anime Streaming Site)

## What this project is
This is a skeleton anime-streaming web app. Content (shows, episodes, images,
metadata) comes from an API described in README.md. **This file governs HOW
you work. README.md explains WHAT the product is.** Read README.md first for
API/data context, then follow the process below for everything else.

Design quality is the #1 priority on this project. A prior attempt (plain
ChatGPT, no process) produced a generic dark-mode streaming template —
competent, but indistinguishable from any other anime site: default
purple/indigo palette, no type hierarchy, cramped edge-to-edge card grid,
inconsistent badge placement, no visual identity. Do not repeat that outcome.

## Hard rule: no code before design direction is locked
Do NOT write component code, pick a color palette, choose fonts, or scaffold
pages until Phase 0 and Phase 1 below are complete and the user has explicitly
approved the resulting DESIGN.md. If you catch yourself about to generate a
hero section before that approval exists, stop and go back to Phase 0.

## Phase 0 — Interview the user first
Ask these one at a time and wait for real answers before proceeding:
1. Mood/tone in 3 adjectives (anime streaming can go moody/cinematic/editorial
   OR playful/bold/saturated — don't assume which).
2. Reference sites/apps whose *feel* they like — ask for 2-3 links or
   screenshots (see Reference sources below if they have none ready).
3. Hard constraints: existing logo/wordmark? A brand color already picked?
   Light mode required?
4. What the landing view leads with — trending grid, continue-watching row,
   editorial hero picks?

## Phase 1 — Write DESIGN.md before touching components
From the Phase 0 answers, produce a `DESIGN.md` file at project root with:
- **Color system**: 1 primary, 1 accent, a neutral scale, semantic colors
  (rating/success/error) as actual hex or OKLCH values — not "primary:
  purple." One line justifying each choice against the Phase 0 mood words.
- **Type system**: max 2 typefaces (one display, one body). A real modular
  type scale, not ad-hoc sizes.
- **Spacing/grid rules**: base spacing unit, card grid gutter, breakpoints.
- **One reference link per major pattern** (hero, grid, nav) from Reference
  sources, with a one-line note on what's being borrowed vs. deliberately
  done differently.

Present DESIGN.md to the user and get explicit approval before Phase 2.

## Phase 2 — Build (only after DESIGN.md is approved)
- Base components on shadcn/ui (Radix + Tailwind) — don't hand-roll basic
  primitives like buttons, dialogs, dropdowns.
- For hero/motion/bento-style blocks, adapt patterns from Aceternity UI or
  Magic UI rather than inventing from scratch — but re-skin every color and
  type value through DESIGN.md, never their defaults.
- Animate only `transform` and `opacity`. Respect `prefers-reduced-motion`.
- Run every finished screen through the Anti-slop checklist before calling
  it done.

## Anti-slop checklist — hard gate, check every screen against this
### P0 — automatic fail, must redo
- [ ] Uses default Tailwind indigo/violet as a solid accent — specifically
      `#6366f1`, `#4f46e5`, `#4338ca`, `#3730a3`, `#8b5cf6`, `#7c3aed`,
      `#a855f7`. Use the accent defined in DESIGN.md instead. This exact
      family is the single most reliable AI tell there is.
- [ ] Hero or CTA uses a two-stop "trust" gradient: purple→blue, blue→cyan,
      or indigo→pink. A flat surface plus deliberate type beats this.
- [ ] Emoji used as feature icons (✨ 🚀 🎯 ⚡ 🔥 💡) in headings, buttons,
      list items, or icon slots. Use 1.6–1.8px-stroke monoline SVG icons
      instead.
- [ ] Display text (h1/h2, show titles) falls back to Inter/Roboto/
      system-ui instead of the display typeface DESIGN.md defines.
- [ ] Rounded card with a colored left-border accent — the generic "AI
      dashboard tile" shape. Drop the radius or drop the left border.
- [ ] Invented metrics ("10x faster," "99.9% uptime," made-up subscriber
      counts) not sourced from the actual API/data.
- [ ] Filler copy — lorem ipsum, "feature one/two/three," placeholder text
      anywhere. An empty section is a composition problem, not a copy
      problem — solve it with layout, don't invent words.
- [ ] Cards sit edge-to-edge with no breathing room, or badges are placed
      with no consistent logic (this was the exact original EetNet problem).

### P1 — should fix
- [ ] Standard hero → grid → footer sequence with zero variation across
      the whole site. Introduce at least one unconventional section
      (e.g. an editorial "staff pick" full-bleed block instead of another
      carousel row).
- [ ] External placeholder image CDNs (unsplash.com, placehold.co,
      picsum.photos) left in instead of real API imagery or a designed
      placeholder state.
- [ ] More than ~12 raw hex values used outside the DESIGN.md token
      definitions — means tokens aren't actually being honored.
- [ ] The accent color used 6+ times on one visible screen. Cap it at
      ~2 visible uses per screen so it still reads as an accent.
- [ ] Nav icons are generic, unstyled icon-font defaults with no
      weight/style pass.
- [ ] Body copy sits over a busy background image with no scrim/contrast
      treatment.

## How to add soul without breaking the rules
Target ratio: ~80% proven, familiar patterns (people already know how to use
a nav bar and a card grid) to ~20% deliberate distinctive choices. Spend the
20% on:
- One bold visual move — a typography choice, a single color decision, an
  unexpected proportion.
- Voice/microcopy specific to EetNet, not generic ("Continue watching"
  instead of "Resume").
- One micro-interaction someone would remember — a hover that moves 2px, a
  rating number that counts up.
- One detail that could only exist on an anime-streaming product built with
  actual care (e.g. episode-progress ring styled to match the accent, not a
  default browser progress bar).

Litmus test: if someone screenshots a finished screen with the EetNet logo
cropped out, could they still tell it's not a generic streaming template?
If not, it's not done yet.

## Reference sources — pull real examples, don't design blind
- **Awwwards.com** — overall craft, animation, interaction reference.
- **Godly.website** — smaller curated feed, strong typography/scroll work.
- **Siteinspire.com** — filter by "Dark" style + "Media & Entertainment."
- **Mobbin.com** — real shipped app screens; search "streaming" for actual
  OTT product patterns. Matters most here — Awwwards skews marketing sites,
  Mobbin skews product UI.
- **Realtime Colors** (realtimecolors.com) — test the DESIGN.md palette live
  on a mock UI before committing.
- **Type-scale.com** — generate the DESIGN.md type scale.

## Definition of done for any screen
1. Matches DESIGN.md values exactly — no ad-hoc colors/sizes introduced
   mid-build.
2. Passes every item in the Anti-slop checklist.
3. States which reference pattern it borrowed structure from and what's
   deliberately different about the execution.
