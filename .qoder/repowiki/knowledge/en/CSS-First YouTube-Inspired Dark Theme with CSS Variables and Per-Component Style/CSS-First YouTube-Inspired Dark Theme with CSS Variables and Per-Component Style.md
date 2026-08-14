---
kind: frontend_style
name: CSS-First YouTube-Inspired Dark Theme with CSS Variables and Per-Component Stylesheets
category: frontend_style
scope:
    - '**'
source_files:
    - src/index.css
    - src/App.css
    - src/components/SectionSlider.css
    - src/components/Navbar.jsx
    - src/features/movie/components/MovieCard.jsx
    - vite.config.js
    - package.json
---

## What system/approach is used

The EetNet frontend uses a **plain CSS + CSS variables** styling approach built on top of Vite (no CSS-in-JS library, no Tailwind, no component UI kit). The visual identity is a **YouTube-inspired dark theme**: a `#0f0f0f` primary background, `#212121` secondary surfaces, `#ff0000` / `#e50914` accent reds, and a Roboto sans-serif font loaded from Google Fonts. All design tokens are declared as CSS custom properties in `:root` inside `src/index.css`, including colors, shadows, typography, sidebar widths, header height, and transition timings. There is no build-time CSS processor beyond what Vite provides natively — the project does not configure Sass/Less or PostCSS plugins.

## Key files and packages

- `src/index.css` (~14.7k lines) — global stylesheet that defines the entire design token system (`:root` variables), base resets, layout scaffolding (`app-container`, `yt-body`, `main-content` with sidebar offset states), utility classes (`yt-surface`, `yt-hover`, `yt-chip`, `glass`, `mp-scroll-row`, `mp-skeleton-card`), and large sections of page-level styles for the home landing, hero, navbar, cards, grids, detail pages, and responsive breakpoints at 1024px/768px/640px.
- `src/App.css` — leftover Vite starter styles plus a few app-level rules using the same `--accent*` variable set.
- `src/components/SectionSlider.css` — self-contained stylesheet for the frosted-glass slide-out navigation panel (`slider-panel`, `slider-card`, `slider-backdrop`, `slider-tab-hint`) with its own `backdrop-filter` blur/saturate glassmorphism look.
- Component JSX files such as `src/components/Navbar.jsx` and `src/features/movie/components/MovieCard.jsx` — these mix both approaches: they reference shared CSS class names (e.g. `movie-tile`, `yt-mobile-bottom-nav`, `yt-mobile-nav-item`) while also applying inline `style={{...}}` objects for dynamic values like hover transforms, gradients, and conditional backgrounds.
- `vite.config.js` — no CSS preprocessor configured; only the React plugin is enabled.
- `package.json` — no CSS framework dependencies (no Tailwind, Bootstrap, MUI, etc.); styling relies purely on vanilla CSS plus the `lucide-react` icon library.

## Architecture and conventions

1. **Design tokens live in one place.** `src/index.css` `:root` block centralizes every color, shadow, font, spacing, and dimension token under semantic names (`--bg-primary`, `--accent-primary`, `--chip-bg`, `--sidebar-width`, `--header-height`, `--transition-fast`, etc.). Components consume these via `var(--...)` rather than hard-coded hex values, which keeps the dark theme consistent across the app.

2. **Global utilities + feature-specific sheets.** Shared layout and utility classes (`yt-surface`, `yt-hover`, `yt-chip`, `mp-scroll-row`, `mp-scroll-item`, `clean-home-hero-*`, `floating-glass-nav`, `btn-primary`, `anime-grid`, `recent-card`) live in `index.css`. Feature or widget-specific styles are split into per-component `.css` files alongside their JSX (e.g. `SectionSlider.css`).

3. **BEM-like naming without a formal methodology.** Class names follow a readable convention: short descriptive names for global components (`navbar`, `hero`, `card-img-wrapper`, `section-title`) and prefixed names for widgets (`slider-panel__header`, `slider-card__content`, `clean-home-hero-badge`). No strict BOM/BEM enforcement is visible, but the pattern is consistent enough to keep selectors scoped by component.

4. **Responsive strategy via CSS `@media` queries.** Breakpoints are defined directly in CSS: `max-width: 1024px` collapses sidebars and stacks layouts, `768px` removes sidebar margins and tightens container padding, `640px` adjusts card grid columns and scroll item sizes. There is no JS-driven responsive logic.

5. **Mixed styling model within components.** Some components (like `MovieCard.jsx`) use inline `style={}` for dynamic hover effects, gradient placeholders, and conditional rendering, while still relying on shared CSS classes for structural layout (`movie-tile`). Other components (like `MobileDrawer` in `Navbar.jsx`) lean heavily on inline styles for the drawer panel, backdrop, and items. This is an observed pattern, not a documented rule.

6. **Dark-only theme with glassmorphism accents.** The theme is intentionally dark (`--bg-primary: #0f0f0f`) with translucent panels using `backdrop-filter: blur(...)` and semi-transparent gradients (e.g. the slide panel background `rgba(16,16,26,0.68)` with `blur(32px) saturate(210%)`). There is no light-mode toggle or alternate theme file.

## Conventions and constraints

- **All colors and dimensions should come from CSS variables in `:root`** — new tokens should be added to `src/index.css` rather than introducing new hardcoded values, so the YouTube-dark palette stays uniform.
- **Global CSS lives in `src/index.css`; component-scoped CSS lives next to the component** (e.g. `SectionSlider.jsx` pairs with `SectionSlider.css`). Inline styles are used for transient/hover state changes but are not the primary styling mechanism.
- **No CSS framework is in use.** The codebase does not import Tailwind, Bootstrap, Material-UI, or any other UI library; adding one would require changing `vite.config.js` and `package.json`.
- **Responsive breakpoints are centralized in CSS media queries** at 1024px, 768px, and 640px — new screens should extend these rather than inventing ad-hoc breakpoints.
- **The theme is dark-only.** There is no `prefers-color-scheme` handling or light-mode variant in the current codebase.