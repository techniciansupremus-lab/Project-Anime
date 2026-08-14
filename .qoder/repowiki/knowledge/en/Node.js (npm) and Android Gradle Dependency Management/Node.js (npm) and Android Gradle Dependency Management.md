---
kind: dependency_management
name: Node.js (npm) and Android Gradle Dependency Management
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - package-lock.json
    - android/build.gradle
    - android/app/build.gradle
    - android/variables.gradle
    - android/settings.gradle
    - android/gradle.properties
---

## Systems Used

This repository manages dependencies for two distinct targets through separate toolchains:

1. **Node.js / npm** — the React/Vite frontend, Express API server, and Capacitor CLI are declared in a single root `package.json` with a lockfile.
2. **Android (Capacitor hybrid app)** — native Android dependencies are managed by Gradle using Maven Central and Google repositories, with version variables centralized in `variables.gradle`.

There is no Go (`go.mod`), Python `requirements.txt`, or vendored third-party source code; all third-party packages are resolved at build time from remote registries.

## Key Files

- `package.json` — declares runtime dependencies (`react`, `express`, `axios`, `@supabase/supabase-js`, `hls.js`, `cheerio`, `@consumet/extensions`, Capacitor plugins) and dev dependencies (`vite`, `oxlint`, `sharp`, `@types/react*`). Scripts wire `dev`, `build`, `server`, `start`, `lint`, and `preview`.
- `package-lock.json` — npm lockfile pinning exact transitive versions for reproducible installs.
- `android/build.gradle` — top-level Gradle file declaring `google()` and `mavenCentral()` repositories and the Android Gradle Plugin (`com.android.tools.build:gradle:8.13.0`) plus Google Services plugin.
- `android/app/build.gradle` — module-level dependencies referencing shared version variables (e.g. `androidx.appcompat:$androidxAppCompatVersion`) and including Capacitor/Cordova subprojects.
- `android/variables.gradle` — centralizes all Android dependency versions (`minSdkVersion`, `compileSdkVersion`, `targetSdkVersion`, `androidxAppCompatVersion`, `junitVersion`, `cordovaAndroidVersion`, etc.) so they can be updated in one place.
- `android/settings.gradle` — includes the `:app` and `:capacitor-cordova-android-plugins` modules and applies `capacitor.settings.gradle`.
- `android/gradle.properties` — project-wide Gradle flags such as `org.gradle.jvmargs=-Xmx1536m` and `android.useAndroidX=true`.

## Architecture and Conventions

### Node.js side
- All JavaScript/TypeScript dependencies live in a **single flat `package.json`** at the repo root rather than per-package workspaces. The project is marked `"private": true` and uses ESM (`"type": "module"`).
- Dependencies use **caret ranges** (e.g. `^19.2.7`, `^8.5.0`, `^1.18.1`) allowing minor/patch updates within the same major version.
- A `package-lock.json` is committed alongside `package.json`, ensuring deterministic builds across environments.
- No private npm registry or `.npmrc` is present; packages resolve directly from the public npm registry.
- Build-time tooling (Vite, Oxlint, TypeScript types, Sharp image processing) is isolated under `devDependencies` and not shipped to production.

### Android side
- Version numbers for every Android library are **pinned to exact strings** inside `android/variables.gradle` (e.g. `androidxAppCompatVersion = '1.7.1'`, `coreSplashScreenVersion = '1.2.0'`, `junitVersion = '4.13.2'`) and referenced via Gradle string interpolation (`implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"`). This is the single source of truth for Android dependency versions.
- Repositories are declared globally in `android/build.gradle` under both `buildscript.repositories` and `allprojects.repositories`, listing only `google()` and `mavenCentral()` — no custom/private Maven repos are configured.
- The Android Gradle Plugin version (`8.13.0`) and Google Services plugin (`4.4.4`) are pinned in the top-level `buildscript.dependencies` block.
- Capacitor Cordova plugins are included as a local Gradle subproject (`:capacitor-cordova-android-plugins`) whose directory is set explicitly in `settings.gradle`; additional JARs can be dropped into `android/app/libs` and picked up via a `flatDir` repository.
- SDK levels (`minSdkVersion = 24`, `compileSdkVersion = 36`, `targetSdkVersion = 36`) are also centralized in `variables.gradle` and consumed by the app module.

## Constraints Observed

- **No vendoring**: neither `node_modules` nor Android AAR/JAR artifacts are checked in; all third-party code is fetched from registries during install/build.
- **Single manifest per target**: there is exactly one `package.json` for the JS stack and one `variables.gradle` for Android versions — no per-feature dependency files.
- **Public registries only**: no `.npmrc`, `GOPRIVATE`, private Nexus/Artifactory URLs, or `GOFLAGS -insecure` were found; all resolution goes to npmjs.org, Google Maven, and Maven Central.
- **Lockfiles enforced**: `package-lock.json` is committed, so `npm ci` will produce identical trees; Android versions are locked via explicit version strings in `variables.gradle` rather than dynamic range resolution.
- **Dev vs runtime separation**: development-only tools (Vite, Oxlint, Sharp, `@types/*`) are placed in `devDependencies` and excluded from production bundles.