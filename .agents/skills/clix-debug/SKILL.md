# Clix Debug & Improve — skill

Project: `bolajiev/clix-mobile` — Expo 54 / RN 0.81 / opencode mobile client.
Use when working on clix-mobile bugs, performance, or UX. Follow docs/architecture.md (D1–D4) — no stopgaps.

## Ground truths

- Server: `https://opencode.bolajiev.com` (basic auth: user `opencode` or `clix`, pass in `~/.env.d/cloudflare.env` CLIX_OPENCODE_PASS). Server is systemd `opencode-serve` on 127.0.0.1:4096.
- Session model: sessions are server-side and shared by all clients. "Current session" per project = latest by `time.updated` (D1). A message sent in the app lands in the same session the terminal shows.
- Streaming: SSE `/global/event` + reconnect catch-up + `/session/status` poll while busy (D2). Never remove the poll.
- Theme: opencode dark palette (deep blacks + peach #FAB283) in `src/theme/tokens.ts`. Dark is the shipped default.
- The vision subagent works: `explain-image.sh <image> [prompt]` (opencode-go/mimo-v2.5, cheap). Use it for any screenshot the user sends.
- User's phone: Samsung Galaxy S10e (SM-G970U1), Android 11, Nigeria (mobile data — flaky networks, expect SSE drops).

## Bug-hunting workflow (research.md)

1. Reproduce in the real channel (server API, vision subagent on screenshots) before fixing.
2. Grep the code for the failure path; check stores for races (zustand `get()`/`set()` ordering, event ordering).
3. Fix with a durable rule, not a one-off. Update docs/architecture.md if a rule changes.
4. Verify: `npx tsc --noEmit`, `npm test`, `npx expo export --platform android`.

## Known failure classes (check these first)

- **Keyboard/input**: KAV behavior padding + adjustResize (manifest) + bottom safe inset in PromptBar. If input hides: check insets, KAV wrapping, `editable` gating (speech), menu absolute positioning.
- **Safe areas**: EVERY screen must clear status/gesture bars (useSafeAreaInsets). Missing inset = "can't tap / too up / doesn't fit phone".
- **Streaming gaps**: SSE never replays; the /session/status poll (6s, events store) is the completion guarantee. Stuck spinners = poll missing or `sending` cleared wrongly.
- **Silent model failure**: 204 on prompt_async but no run = model/provider without key. Check `/provider` → `connected`; server default model in `/root/.config/opencode/opencode.jsonc`.
- **Emoji creep**: user hates emojis — Ionicons only. grep for text glyphs after any UI work.
- **Borderless chat**: no bubbles — text on paper, avatar for assistant, compact tool rows.
- **Old-owner bleed**: never reintroduce `dzianisv/agentlabs/vibeteaichnologies/opencode-mobile`.

## Verification helpers

- `curl -u opencode:$PASS https://opencode.bolajiev.com/session` — list sessions
- `.../session/<id>/message` — messages incl. file parts (extract screenshots sent via the app)
- `.../provider` — `connected` list (usable models)
- `journalctl -u opencode-serve` — server logs
- `grep -a "global/event" /var/log/nginx/access.log` — SSE connection health (small byte counts = short-lived)
