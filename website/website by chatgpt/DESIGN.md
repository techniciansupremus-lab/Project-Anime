# EetNet Design Direction

## Brief and guardrails

**Mood:** premium, cinematic, minimal.  
**Mode:** dark only.  
**Landing order:** one confident editorial hero, followed immediately by a curated/trending rail. The hero is never a rotating multi-title carousel.  
**Grid pages:** low-chrome and image-led: large stills, strong titles, and metadata revealed only when useful. No permanent rating-badge or genre-pill clutter.

### Proposed identity

**Wordmark:** `EetNet` set in the display face with a custom, slightly condensed `E`; it should read as an editorial film title rather than a tech-service logo. The wordmark is mostly warm white, with a single muted-gold detail (the middle arm of the E) when used on dark surfaces. This is a proposed direction, not a locked name or logo.

**Signature detail:** episode progress is a thin, muted-gold arc at a card's lower edge. It is the only persistent status treatment; all other card metadata remains quiet until hover/focus.

## Color system

| Token | Value | Use |
|---|---:|---|
| `ink-950` | `#0B0D0F` | Page background |
| `ink-900` | `#12161A` | Navigation and deep surfaces |
| `ink-800` | `#1A2025` | Raised surfaces / menus |
| `ink-700` | `#283139` | Borders and quiet dividers |
| `fog-500` | `#99A3AA` | Secondary text |
| `paper-100` | `#F4F1EA` | Primary text and wordmark |
| `gold-500` (primary) | `#C8A45D` | Sparse brand action, progress, active state |
| `ember-500` (accent) | `#D95D45` | Exceptional emphasis: live/error-adjacent alerts only |
| `success-500` | `#5EAD83` | Completed / available |
| `rating-500` | `#C8A45D` | Rating only where an actual API rating is shown |
| `error-500` | `#D95D45` | Failed action / destructive feedback |

- **Primary — muted gold:** its restrained warmth creates premium cinematic contrast against near-black, without the default violet/indigo streaming look.
- **Accent — ember:** a low-saturation red-orange adds human heat for rare moments, rather than competing with the imagery or becoming a second primary.
- **Neutrals:** blue-charcoal ink and warm-paper text make the interface feel composed and filmic, not flat black or a generic dark dashboard.
- **Semantic colors:** remain functional and are never decorative; the gold rating token is used only with real API data.

**Usage constraint:** gold appears in no more than two visible locations per screen; ember is reserved for errors or genuinely exceptional state. No gradients are part of this system.

## Type system

**Display:** [Bodoni Moda](https://fonts.google.com/specimen/Bodoni+Moda) — hero title, page title, section title, and show titles. High contrast, used with deliberate short line lengths for an editorial, cinematic voice.  
**Body:** [DM Sans](https://fonts.google.com/specimen/DM+Sans) — navigation, controls, metadata, synopsis, and utility copy. Clear at small sizes without falling back to Inter, Roboto, or a system face.

**Browse-intro exception:** the A1-inspired category browse headline uses DM Sans at display scale and medium weight, with a restrained paper→gold→fog text gradient on its closing phrase. This exception is limited to the browse-promotion message; titles remain in Bodoni Moda.

**Browse-control exception:** the category search action and genre filters use a distinctly tactile, three-dimensional treatment: a top edge highlight, a 4px lower edge, and a soft cast shadow. The paper search action and active filter use a fog-colored lower edge; inactive filters use a darker ink edge. Both collapse to 1px while pressed. This tactile treatment is limited to browse controls, plus the hover-revealed card play control; it does not apply to other cards or standard buttons.

**Drama browse exception:** Drama is a compact streaming dashboard rather than a gallery grid: one image-led hero, a resume rail, then denser 16:9 editorial rails. It uses a muted rose accent (`#E86D7B`) only for its episode and progress cues; EetNet gold remains the global brand accent.

**Drama browse exception:** Drama is an isolated red-and-black adaptation of the user-provided MIT-licensed Netflix React reference, using its streaming-home composition directly: fixed transparent-to-black navigation, an oversized banner, clone-style expanding rows, poster rail, and quick-view overlay. It does not share EetNet's page frame, typography, card language, or navigation; only an EetNet wordmark replaces the reference's Netflix mark. Authentication screens and reference branding/assets are excluded. Its red is `#B20710` against `#111` black, and its live movie data comes from TMDB with the required in-app attribution.

**Movies browse exception:** Movies is a standalone dark EetNet feature screen with a scroll-staged central story, scaled preview reveal, and a low-chrome moving reel. Its interaction mechanics are independently implemented from allowed concepts in the user-provided Apple TV tutorial repository; the repository’s direct design, Apple branding, and assets are not reused.

**Comics browse exception:** at the user's explicit direction, Comics is an isolated, light catalogue experience modeled on Webtoon’s public browse structure: a compact two-tier header, ranked discovery strip, genre filters, featured original, and day-based release board. It uses its own clean green (`#00D564`) on white and slate (`#17212B`) surfaces. EetNet Comics uses original wording and mock/API catalogue data only; it does not use WEBTOON branding, artwork, or copied editorial content.

**Section-wordmark exception:** the category headers append their destination in a page-specific accent while retaining `EetNet` in paper white: `ANIME` in gold, `DRAMA` in purple (`#A56DE2`), and `MOVIES` in red. This is confined to page identity, not reused as a general purpose accent.


**Rail interaction:** horizontal rails hide browser scrollbars. On pointer devices, a subdued chevron is revealed at either edge of a rail; selecting it advances the row smoothly by roughly three quarters of its visible width. Touch and trackpad scrolling remain available.

| Token | Size / line-height | Role |
|---|---|---|
| `caption` | 12px / 16px | Episode/runtime utility metadata |
| `label` | 14px / 20px | Navigation, buttons, compact labels |
| `body` | 16px / 24px | Synopsis and general reading |
| `title-sm` | 20px / 24px | Card title |
| `title-md` | 25px / 30px | Rail section heading |
| `title-lg` | 31px / 37px | Grid/category title |
| `display-sm` | 39px / 41px | Compact editorial heading |
| `display-md` | 49px / 51px | Tablet hero title |
| `display-lg` | 61px / 63px | Desktop hero title |

Display text uses Bodoni Moda at a modest negative tracking only at `display-*` sizes; all other text uses normal tracking. Body text is never artificially condensed.

## Spacing and grid rules

- **Base unit:** 8px. Valid spacing increments are 8, 16, 24, 32, 48, 64, 96, and 128px.
- **Page frame:** `max-width: 1440px`; horizontal inset is 48px (desktop), 32px (tablet), and 16px (mobile). Content never runs edge-to-edge.
- **Breakpoints:** mobile `0–639px`, tablet `640–1023px`, desktop `1024–1439px`, wide `1440px+`.
- **Rails:** 16px card gutter on desktop/tablet; 12px on mobile. A rail exposes a sliver of its next card to signal horizontal continuation without extra chrome.
- **Category grid:** 4 columns at wide desktop, 3 at desktop/tablet, 2 on mobile; 32px gutters at wide desktop, 24px desktop/tablet, and 16px mobile. Category thumbnails fill their grid cells at a 2:3 editorial ratio with an 8px soft corner and a 16px text gap below. This is the explicit category-grid exception to the otherwise sharper EetNet card treatment, inspired by the user-provided gallery reference.
- **Hero:** full-bleed within the viewport, but its content aligns to the page frame. On desktop it has a 16:9 image field and a text column capped at 480px; a left-to-right dark scrim protects all text over imagery.
- **Card shape:** image-forward and mostly square-cornered (2px maximum radius) in rails and playback contexts. Category galleries alone use the approved 8px soft-corner exception above. There are no colored left borders, dashboard tiles, or floating badge stacks.

## Pattern references

| Pattern | Reference | Borrowed | Deliberately different for EetNet |
|---|---|---|---|
| Editorial hero | [Apple TV](https://tv.apple.com/) | A single large, cinematic title presentation followed by content rails. | EetNet keeps one static pick rather than a promotional rotation, and uses quiet film-title typography instead of subscription messaging. |
| Curated rail | [Gateplay on Dribbble](https://dribbble.com/shots/27139093-Gateplay-Luxury-Modern-Streaming-Platform-Website-UI-Design) | The composed, luxury sense of pacing between featured content and a horizontal selection. | EetNet removes ornamental UI and decorative metrics, allowing real anime imagery and title hierarchy to carry the layout. |
| Category grid | [MUBI](https://mubi.com/) | Low interface chrome, generous stills, and confidence in image-plus-type. | EetNet uses anime cover art and its progress arc, with metadata deferred to hover/focus rather than permanently layered over posters. |
| Navigation | [Apple TV](https://tv.apple.com/) | A restrained navigation surface that recedes behind the content. | EetNet uses a compact wordmark and deliberately weighted 1.7px monoline SVG icons; no default icon-font treatment. |

## Screen-level rules

- The landing page must include the hero, its first curated rail, and then an editorial full-bleed staff-pick block before further rails, avoiding a generic hero-to-grids sequence.
- Hero and image-overlaid copy always receive a dedicated ink scrim; text never relies on the image alone for contrast.
- Use actual API artwork wherever available. Until API data is connected, use a designed empty/loading state—not third-party placeholder-image CDNs or invented show statistics.
- Motion is restricted to `transform` and `opacity`, respects `prefers-reduced-motion`, and may use a 2px artwork lift or crop shift on hover. No motion is required for comprehension.
- Copy should be specific and factual (for example, “Continue watching” and actual episode data), with no filler or unsourced claims.

## Approval gate

No component code, palette deviation, font substitution, or page scaffolding may begin until this document is explicitly approved.
