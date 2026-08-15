# Clix

**The open-source Android client for the [opencode](https://github.com/sst/opencode) AI coding agent.**

Run AI coding sessions from your phone against your own self-hosted opencode server — stream responses, watch tool calls, approve permissions, dictate prompts, attach images. One server, one conversation, everywhere (phone + terminal + web).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/Docs-GitHub%20Pages-4CAF50)](https://bolajiev.github.io/clix-mobile/)

> **Not affiliated with opencode.** Clix is an independent client for the opencode agent. It talks to an opencode server you run yourself, using opencode's open HTTP API.

---

## What it is

- **Streaming chat** — live SSE-driven responses with an in-flow thinking indicator, streaming cursor, and tool-call rows
- **Borderless, dark-first UI** — opencode palette (deep blacks + peach accent), Claude-style navigation (drawer + sessions grouped by project folder)
- **Composer with real controls** — @ attachments, / commands, inline model picker (connected providers only), dictation with animated equalizer, paste, auto-grow
- **One conversation everywhere** — sessions are server-side; the phone and the terminal attach to the same server and stay in sync live
- **Permissions & questions** — inline approval cards, one question at a time with pager
- **Reliable streaming** — SSE + reconnect catch-up + `/session/status` safety poll + 15s session poll: completion always surfaces
- **Voice + images** — dictation (locale-aware), image attachments (auto-compressed to JPEG base64)

## Install

**Android APK** (arm64, ~38 MB) — built via EAS; grab the latest from the **Releases** tab or your build.

Settings → Documentation opens the setup guide: https://bolajiev.github.io/clix-mobile/guide/

## Connect

1. Run opencode on your machine or server:
   ```
   opencode serve --hostname 0.0.0.0 --port 4096
   ```
2. In Clix: **Connections → Add** — enter the URL (`http://<ip>:4096` on your LAN, or your https endpoint), username/password if your server uses basic auth.
3. The app auto-lists sessions grouped by project folder; the highlighted one is the conversation you were last in.

**For live terminal ↔ phone sync**, attach your terminal to the same server:

```
opencode attach http://127.0.0.1:4096 [-s <sessionID>]
```

See [APP.md](APP.md) for the full sync model and troubleshooting.

## Architecture

- Expo SDK 54 / React Native 0.81 / expo-router / zustand
- Design system: `src/theme/tokens.ts` (dark default, opencode palette)
- UI kit: `src/components/ui/` · Chat primitives: `src/components/chat/`
- Stores: sessions, events (SSE), connections, catalog, settings
- Docs: [APP.md](APP.md) (sync model, server setup, building) · [docs/architecture.md](docs/architecture.md) (design decisions D1–D4)

## Building

```bash
npm install
npx tsc --noEmit && npm test      # verify
npx expo export --platform android # bundle smoke test
npx eas-cli build -p android --profile preview
```

The `preview` profile produces a single arm64 APK; `production` builds a minified AAB for the Play Store.

## Repository

Clix is a standalone repository (not a fork). It shares the MIT-licensed lineage of `dzianisv/opencode-mobile` — the project it grew from — with a fully independent package (`com.clix.mobile`), design, docs, and roadmap.

## License

MIT
