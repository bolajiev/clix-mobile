# Clix Redesign Spec — Claude-style UI/UX

**Status: APPROVED (2026-08-12) — implement against this spec.**
**Theme decision: DARK MODE is the shipped default** (user-approved). Light theme kept for reference only.

Reference mockup: `clix-claude-style.html` (interactive, all screens + drawer wired up, dark default).
Build against that visually; this doc is the written spec.

## 1. Design tokens

Light (reference):
```css
--cream:       #FAF9F5   /* app background */
--cream-2:     #F3F1E9   /* subtle fills: icon chips, input backgrounds, segmented track */
--card:        #FFFFFF   /* cards, sheets, drawer surface can use --cream instead */
--line:        #E8E6DC   /* all hairline borders/dividers */
--ink:         #3D3929   /* primary text */
--ink-soft:    #6B6656   /* secondary text, subtitles, descriptions */
--ink-faint:   #A8A395   /* placeholder text, disabled, chevrons */
--accent:      #D97757   /* terracotta — primary action color, toggle-on, active states */
--accent-soft: #F3E3D8   /* accent tint backgrounds (icon chips, selected rows, badges) */
--accent-deep: #BC5F3E   /* accent text on light backgrounds */
--track-off:   #DEDBCF   /* toggle-off track */
```

Dark (SHIPPED DEFAULT):
```css
--cream:       #262624   /* app background */
--cream-2:     #30302D   /* subtle fills */
--card:        #343431   /* cards, sheets, groups */
--line:        #3E3E38   /* hairlines */
--ink:         #F5F4F1   /* primary text */
--ink-soft:    #B5B4AC   /* secondary text */
--ink-faint:   #74736C   /* placeholders, chevrons */
--accent:      #D97757   /* terracotta — unchanged across themes */
--accent-soft: #3B2B22   /* accent tint backgrounds */
--accent-deep: #E59274   /* accent text on dark backgrounds */
--track-off:   #4A4945   /* toggle-off track */
```

Fonts:
- Display/headings: **Source Serif 4** (600/700 weight) — screen titles, drawer brand, section-level headers.
- Body/UI: **Inter** (400–700) — everything else.
- Monospace: **IBM Plex Mono** — URLs, technical strings (e.g. connection host).

Corner radii: 16px for cards/groups, 10–12px for icon chips and buttons, 999px (pill) for badges/toggles/segmented controls.

## 2. Navigation model (change from current app)

Replace the 3-tab bottom bar (Sessions / Connections / Settings) with:

1. **Home screen** — top app bar with a hamburger icon (left) that opens a slide-out drawer, and the app wordmark centered.
2. **Drawer** (slides in from left, ~82% width, max 320px, scrim behind it) — contains:
   - "New session" action (accent-colored, plus icon)
   - "Connections" link (single row, leads to Connections screen)
   - Divider
   - "Sessions" section label with the live count
   - Scrollable list of session/project rows (colored dot + name + message count), selected one highlighted with accent-soft background
   - Footer inside the drawer: avatar + name (left), gear icon (right) → gear opens Settings
3. **Bottom account bar** (persists on Home only) — avatar + username on the left, single gear icon on the right. Gear opens **Settings** directly. No more separate "Connections" tab in the main bar — it now lives one level down, inside Settings and inside the drawer.
4. **Settings screen** — has an "Account" section at the top with a single row: **Connections** (shows connected host + status, tappable, chevron to indicate it navigates deeper). Everything else (Security, Notifications, Privacy) unchanged in grouping, restyled per tokens above.
5. **Connections screen** — reached only via Settings → Connections, or via the drawer's Connections link. Has its own back button to Settings.

This mirrors the actual Claude app: hamburger drawer for session/chat navigation + a lightweight bottom identity bar with settings tucked behind the gear, rather than three permanent tabs competing for space.

## 3. Screen specs

### Home
- App bar: `☰` icon button (opens drawer) — brand wordmark "Clix" centered — mirrored empty spacer on the right for symmetry.
- Body: centered empty/active-session state — glyph, current session name as heading, one-line status ("Last synced Xm ago"), and a pill chip showing live connection status with a pulsing dot.
- FAB (`+`) bottom-right, above the account bar, starts a new session.
- Bottom account bar: avatar circle with initial, display name, gear icon on the right.

### Drawer
- Header: "Clix" wordmark + close (`✕`) button.
- Primary action row: **New session** (accent text/icon).
- Secondary link row: **Connections** (neutral ink color, icon left).
- Divider.
- Section label: "Sessions · {count}".
- Scrollable rows: colored dot (per-project, cycle 3–4 muted hues, not neon), project name, message count right-aligned in faint text. Selected/current project gets `--accent-soft` row background and accent-colored bold name.
- Footer (pinned bottom of drawer): avatar + name, gear icon → Settings.
- Scrim: transparent → `rgba(20,18,13,0.45)` on open, tap-to-close. Drawer slides via `translateX`, ~280ms ease.

### Settings
- Back chevron + "Settings" serif title.
- **Account** group (new): single row → **Connections**, subtitle shows connected host + implicit status, chevron.
- **Security** group: Unlock with biometrics, Confirm before sending — both toggles.
- **Notifications** group: Permission requests, Questions, Task completed, Errors, Connection lost — all toggles, plain-language copy (first/second person, not system-internal phrasing).
- **Privacy** group: Share diagnostics toggle.
- All rows: icon chip (accent-soft background) + title + subtitle + control, consistent 38×38 icon chip, 10px radius.

### Connections
- Back chevron + "Connections" title.
- **Active connection card** (not just a list row): accent-bordered card with icon avatar, name, "Connected" badge, monospace host string, and a live latency/status line ("Responding normally · 42ms") so state is visible at a glance.
- **Preferences** group: "Messages per page" as a segmented control (10/25/50/100/200), plain-language helper text underneath explaining the tradeoff.
- Tip card (dashed border, muted): explains what adding another connection does.
- FAB (`+`) to add a new connection.

## 4. Components

- **Toggle**: 44×26 pill, off = `--track-off` track, on = `--accent` track, white knob, 20px, slides with a ~150ms transition.
- **Segmented control**: pill buttons in a row, unselected = `--cream-2` fill with hairline border, selected = solid `--ink` fill with cream text.
- **Icon chip**: 38×38, 10px radius, `--accent-soft` background, single emoji/icon centered — used consistently across Settings and Connections rows.
- **Badge** (e.g. "Connected"): small pill, solid `--accent` fill, white bold text, 10.5px.
- **Count pill**: small pill, `--accent-soft` fill, `--accent-deep` text, used for session message counts.
- **Group/card**: surface (card token), hairline border, 16px radius, rows divided by hairlines, last row has no divider.

## 5. Copy rules

- First/second-person, plain language over system terminology: "Unlock with biometrics" not "Require Biometric to Open"; "Connection lost" not "Connection (extended period)".
- Every toggle row gets a one-line subtitle explaining *when* it fires, not just its name.
- Status/tip text uses present tense and states the actual current value where possible (e.g. "Responding normally · 42ms" over static "Active").

## 6. Interaction notes

- Drawer open/close: scrim fade + drawer slide together, tap scrim or `✕` to close, selecting a session or the Connections link also closes the drawer.
- Settings → Connections and back are simple screen swaps (no drawer involvement); back chevron returns to the screen that opened it (Connections' back goes to Settings, Settings' back goes to Home).
- Long-press on a drawer session row: reserved for rename/pin (not built in mockup, flagged as a future affordance).

## 7. Implementation order (proposed)

1. Theme tokens (dark default) + fonts + shared components (toggle, chip, badge, segmented, card/group)
2. Navigation restructure: remove 3-tab bar → Home + drawer + account bar
3. Settings screen (groups + toggles + Connections row)
4. Connections screen (active card + segmented + tip)
5. Session screen restyle to match tokens (chat bubbles, composer) — separate pass with its own spec
