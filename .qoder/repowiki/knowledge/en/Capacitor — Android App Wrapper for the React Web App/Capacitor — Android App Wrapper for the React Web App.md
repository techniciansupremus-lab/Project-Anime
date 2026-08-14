---
kind: external_dependency
name: Capacitor — Android App Wrapper for the React Web App
slug: capacitor
category: external_dependency
category_hints:
    - client_constraint
scope:
    - '**'
---

The project wraps the Vite-built web app (output `dist/`) into an Android app via Capacitor v8 (`com.eetnet.app`, app name 'EetNet'). Plugins include SplashScreen, StatusBar, Keyboard, Browser, Filesystem, Preferences, and App.

- `capacitor.config.json` configures splash screen (dark background, immersive), status bar (dark style), keyboard resize behavior, and allows mixed content for development.
- `src/utils/nativeApp.js` and `src/utils/storage.js` bridge Capacitor Preferences for persistent auth state when running inside the native app.