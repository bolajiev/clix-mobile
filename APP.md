# Clix — App documentation

Clix is a React Native / Expo mobile client for [opencode](https://opencode.ai) —
the AI coding agent. It talks to an opencode server you run yourself and brings
your agent sessions to your phone: chat, watch tool calls, approve permissions,
dictate, attach images.

- Repo: `bolajiev/clix-mobile` (standalone)
- Package: `com.clix.mobile` · App name: **Clix**
- Stack: Expo SDK 54, React Native 0.81, expo-router, zustand, SSE-driven chat
- Design: opencode dark palette (deep blacks + peach `#FAB283`), Claude-style
  navigation (drawer + grouped sessions), borderless chat

---

## 1. The sync model (read this first)

**One server, one conversation, everywhere.** Sessions are server-side entities
shared by every client: the phone app, the terminal TUI, the web UI. There is no
per-device session state.

```
                    ┌────────────────────────────┐
                    │   opencode server (serve)  │
                    │   127.0.0.1:4096           │
                    │   sessions + messages + SSE│
                    └──────┬──────────┬──────────┘
                           │          │
              HTTPS + auth │          │ attach (same server!)
                           ▼          ▼
                    ┌──────────┐  ┌──────────┐
                    │  Clix app│  │ Terminal │
                    │ (phone)  │  │  TUI     │
                    └──────────┘  └──────────┘
```

### The two rules that make it work

1. **The app and the terminal must talk to the SAME server.**
   - The app connects to `https://opencode.bolajiev.com` (nginx → serve :4096).
   - The terminal must **attach** to that same backend, never run standalone:
     ```
     opencode attach http://127.0.0.1:4096 [-s <sessionID>]
     ```
     A standalone `opencode` TUI spawns its **own in-process server** with its
     own event stream — it cannot see app messages and the app cannot see its.
     This was the #1 cause of "I sent a message and it didn't show up".
   - Non-interactive runs should also attach:
     ```
     opencode run --attach http://127.0.0.1:4096 "prompt"
     ```

2. **One current session per project.** The most recently updated session in a
   project directory is "the current session" — the terminal resumes it, the
   app highlights it (peach border + "Current" tag) and continues it. A message
   sent from the phone lands in the same conversation the terminal is watching.
   `New session` is always an explicit action.

### How updates flow (three independent layers)

| Layer | When | Latency |
|---|---|---|
| **SSE** (`/global/event`) | live streaming while connected | instant |
| **Reconnect catch-up** | after any SSE drop — re-fetch open session + pending permissions | ~1–15s |
| **Status poll** (`/session/status`) | while ANY session is busy — clears busy flags on missed idle, fetches messages once | 6s |
| **Session poll** (fallback) | while the chat screen is open — catches terminal-written messages the serve never emits events for | 15s |

Completion must always surface: SSE, else reconnect catch-up, else status poll,
else the 15s poll. Four layers, no single point of failure.

### A server quirk you need to know

The serve API's default session list returns only the **global project's**
sessions (`project_id = 'global'`). Sessions created by opencode CLI instances
in other working directories get a **directory-hash project id** and are
invisible to the default list — the phone couldn't see terminal conversations.

The app works around this by listing sessions **per known directory**
(`GET /session?directory=<path>` via `clientForDirectory`) and merging them.
On a fresh install, open the folder switcher and pick a directory once — it's
remembered as a recent, and all its sessions become visible.

---

## 2. Architecture (app)

```
app/                      expo-router routes
├── index.tsx             Home: connection pill, sessions grouped by project,
│                         directory switcher, template chips, drawer (rename/delete)
├── settings.tsx          Appearance (theme+language), connections, notifications,
│                         privacy, about
├── connections.tsx       Active connection card, preferences, add
├── session/[id].tsx      Chat: borderless messages, in-flow thinking loader,
│                         search, pull-to-refresh, PromptBar composer
└── connection/           Add/edit connection (quick + advanced modes)

src/
├── theme/tokens.ts       THE design system (dark default = opencode palette)
├── components/ui/        Kit: Toggle, Row, Group, Segmented, Badge, chips, ScreenHeader
├── components/chat/      Chat primitives: PromptBar (composer with @/ /model menus,
│                         dictation, rainbow sweep), MessageBubble (borderless),
│                         ToolRow, StreamingLoader (pixel grid + timer),
│                         QuestionPrompt (approval card), PermissionPrompt
├── stores/               zustand, one job each:
│   ├── sessions.ts       session list, messages/parts, sending flags, seq-guarded
│   ├── events.ts         SSE connection, sessionStatus, poll safety net, permissions
│   ├── connections.ts    transport: servers, auth, per-directory clients
│   ├── catalog.ts        models/agents/commands (connected providers only)
│   ├── settings.ts       page size, notifications, locale, appearance
│   └── auth.ts           biometric lock
└── lib/                  sdk.ts (HTTP+SSE client), speech, notifications, i18n, ...
```

See `docs/architecture.md` for the permanent design decisions (D1–D4).

---

## 3. Server setup (the box)

- `opencode serve` runs as systemd unit `opencode-serve` (auto-restart), bound
  to `127.0.0.1:4096`.
- Public access: `https://opencode.bolajiev.com` → nginx with basic auth
  (users `clix`/`opencode`, pass in `~/.env.d/cloudflare.env`) → SSE-friendly
  proxy (`proxy_buffering off`) → TLS via Let's Encrypt (auto-renews).
- DNS: Cloudflare `opencode` A → `167.86.91.92` (proxied).
- Default model: `opencode-go/deepseek-v4-flash` in `/root/.config/opencode/opencode.jsonc`.
  Only providers with real keys are usable — check `GET /provider` → `connected`.
- Backups: `cron` daily 03:00 → `sqlite3 .backup` of the opencode DB to
  `/var/backups/opencode/` (keeps 7).

## 4. App connection settings

| Field | Value |
|---|---|
| Mode | Advanced |
| URL | `https://opencode.bolajiev.com` (**no port** — 4096 is not public) |
| Username | `clix` |
| Password | in `~/.env.d/cloudflare.env` (`CLIX_OPENCODE_PASS`) |

Quick mode works with `https://opencode.bolajiev.com:443` (username defaults to
`opencode`, which also exists in htpasswd).

## 5. Building

```bash
npm install
npx tsc --noEmit && npm test          # verify
npx expo export --platform android    # bundle smoke test
npx eas-cli build -p android --profile preview
```

The `preview` profile produces a **single arm64 APK** (~38 MB) via
`gradleCommand: ":app:assembleRelease -PreactNativeArchitectures=arm64-v8a"`.
The `production` profile builds an AAB with R8 minify for the Play Store.

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Sent from phone, not in terminal" | Terminal must be `opencode attach http://127.0.0.1:4096` — not standalone |
| "Sent from terminal, not on phone" | Wait ≤15s (session poll) or check the app is viewing the same session |
| App can't see a conversation | Open the folder switcher, pick the project dir once (project_id quirk, §1) |
| Message accepted (204) but no response | Model provider has no key — check `/provider` → `connected`, fix server default model |
| Stuck "processing" spinner | Status poll clears it within 6s once the server confirms idle |
| Can't tap / UI under system bars | Rebuild — safe-area insets are in code since commit `fda9e3d` |

## 7. Tooling

- **Vision subagent**: `explain-image.sh <image> [prompt]` — cheap multimodal
  (`opencode-go/mimo-v2.5`), used to analyze screenshots the user sends.
- **Bug-hunting skill**: `.agents/skills/clix-debug/SKILL.md` — architecture
  ground truths + known failure classes.
- **Design mockup**: `docs/design/clix-claude-style.html` (Vercel) + spec
  `docs/design/claude-style-spec.md` — visual source of truth.
