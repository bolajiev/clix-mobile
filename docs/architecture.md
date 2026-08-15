# Clix Architecture — Long-term decisions

Status: APPROVED (2026-08-13). These are permanent design decisions, not stopgaps.
If a change would violate one, update this document first.

## D1 — One "current session" per project, shared by all clients

Sessions are server-side entities shared by every opencode client (TUI, web,
IDE, mobile). There is no per-device session state.

**Convention:** the most recently updated session in a project is *the current
session* — the one the terminal resumes, the web app opens, and the app
continues.

- The app highlights the latest-updated session per project group (peach border
  + "Current" tag) and opens it on tap. A message sent from the phone lands in
  the same conversation the terminal is watching.
- The app stores no local "my session" — server truth only (`time.updated`),
  zero drift.
- "New session" is an explicit user action (FAB / drawer).
- Result: send from phone → appears in the terminal live, and vice versa.

## D2 — Streaming: SSE is the source of truth; /session/status is the safety net

SSE drives all live updates and never replays missed events. To guarantee the
user always sees progress and completion:

- **SSE** (`/global/event`) updates messages, parts, statuses in real time.
- **Reconnect catch-up**: on every genuine SSE reconnect, re-fetch the open
  session's messages (events missed during the outage are re-synced) and clear
  stale busy flags.
- **Status polling**: while ANY session is busy, poll `GET /session/status`
  (one cheap call for the whole server) every 6s. On a busy→idle transition we
  didn't see on SSE, clear the local busy state and fetch that session's
  messages once. The timer lives for the connection lifetime; the network
  fetch happens only while something is busy.
- No per-screen polling. The poller lives in the events store.

## D3 — UI/UX is a system

- `src/theme/tokens.ts` is the single source of colors/type (opencode dark
  palette: deep blacks + peach `#FAB283`; light: cream + terracotta). Dark is
  the shipped default.
- `src/components/ui/*` is the design kit: Toggle, IconChip, Badge, CountPill,
  Segmented, Group/Rows, ScreenHeader.
- `src/components/chat/*` are the chat primitives: PromptBar (composer with
  @ // model menus, dictation, auto-grow), ToolRow (compact tool calls),
  StreamingLoader (pixel-grid + elapsed), QuestionPrompt (approval card),
  MessageBubble (borderless chat), PermissionPrompt.
- `docs/design/claude-style-spec.md` + `docs/design/clix-claude-style.html`
  are the written/visual source of truth. Redesigns update the spec first.
- Navigation: expo-router Stack + drawer overlay on Home. The 3-tab bar is
  permanently removed.

## D4 — State boundaries

Zustand stores, each with one job:

- `sessions` — session list, messages, parts, sending flags, watchdog
- `events` — SSE connection, sessionStatus, permissions, questions
- `connections` — transport (servers, auth, per-directory clients)
- `catalog` — models/agents/commands
- `settings` — page size, notifications, locale
- `auth` — biometric lock

The only cross-store writes are gated and documented (events→sessions
`sending`, guarded by SSE-as-truth comments).

## Rules of thumb

- No stopgap that is "meant to be replaced". If a fix can't be stated as a
  durable rule (D1–D4), rethink it.
- Verify in the real channel (server API, screenshots via the vision
  subagent) before and after changes.
- Session selection: server truth (`time.updated`), never local cache.
- Completion must always surface: SSE, else reconnect catch-up, else status
  poll — three independent layers.

## D5 — Latency architecture (2026-08-14)

SSE is the ONLY real-time path; every poll is a bounded safety net, never the
primary. Perceived latency rules:

1. **Fast reconnect** — first retry 500ms, backoff [500,1k,2k,4k,8k,15k]ms
   jittered, cap 15s. A blip recovers in under a second.
2. **Resume-aware SSE** — on AppState→active, if the stream has been silent
   >15s while marked "connected" (mobile networks silently drop long-lived
   connections), force a fresh connection instead of waiting on the dead one.
   Tracks `lastEventAt` on every received event.
3. **Direct connection is the end-state** — the Cloudflare proxy is the only
   remaining latency variable (intermittent SSE buffering + an extra hop
   Nigeria→CF→Germany). Recommended: grey-cloud the `opencode` DNS record so
   the phone connects straight to the VPS over TLS. Tradeoff: loses CF edge
   protection (basic auth + TLS already on the origin). Manual step (token is
   DNS-read-only).
4. **Poll floors are bounded and documented** — /session/status 6s (completion
   safety), session poll 15s (terminal→phone when SSE is down). They exist
   ONLY as fallbacks; on a healthy connection updates are SSE-live (~0ms).
5. **First-token latency is server-side** (LLM + provider) — not a client
   concern. Client-side, chunk arrival is the render cadence (React batches);
   do not add per-event timers.
