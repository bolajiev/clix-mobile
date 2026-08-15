import { useColorScheme } from "react-native"
import { useSettings } from "../stores/settings"

// Clix 2.0 design tokens — Claude-style (approved spec, dark is the shipped default).
// See docs/design/claude-style-spec.md for the written spec + mockup.

export interface Theme {
  dark: boolean
  cream: string // app background
  cream2: string // subtle fills: icon chips, input backgrounds, segmented track
  card: string // cards, sheets, groups
  line: string // hairlines, dividers
  ink: string // primary text
  inkSoft: string // secondary text
  inkFaint: string // placeholders, chevrons, disabled
  accent: string // terracotta — primary action, toggle-on, active states
  accentSoft: string // accent tint backgrounds
  accentDeep: string // accent text on the current background
  trackOff: string // toggle-off track
  serif: string // display font family
  body: string // UI font family
  mono: string // monospace font family
}

export const FONT_SERIF = "SourceSerif4_600SemiBold"
export const FONT_SERIF_BOLD = "SourceSerif4_700Bold"
export const FONT_BODY = "Inter_400Regular"
export const FONT_BODY_MEDIUM = "Inter_500Medium"
export const FONT_BODY_SEMIBOLD = "Inter_600SemiBold"
export const FONT_BODY_BOLD = "Inter_700Bold"
export const FONT_MONO = "IBMPlexMono_400Regular"
export const FONT_MONO_MEDIUM = "IBMPlexMono_500Medium"

const LIGHT: Theme = {
  dark: false,
  cream: "#FAF9F5",
  cream2: "#F3F1E9",
  card: "#FFFFFF",
  line: "#E8E6DC",
  ink: "#3D3929",
  inkSoft: "#6B6656",
  inkFaint: "#807A6C", // AA 4.05:1 on cream — placeholder text, chevrons
  accent: "#D97757",
  accentSoft: "#F3E3D8",
  accentDeep: "#BC5F3E",
  trackOff: "#DEDBCF",
  serif: FONT_SERIF,
  body: FONT_BODY,
  mono: FONT_MONO,
}

const DARK: Theme = {
  dark: true,
  // opencode TUI palette: near-black charcoal steps + peach accent
  cream: "#0A0A0A", // darkStep1 — app background
  cream2: "#1E1E1E", // darkStep3 — subtle fills: chips, inputs, segmented track
  card: "#141414", // darkStep2 — cards, sheets, groups
  line: "#323232", // darkStep5 — hairlines
  ink: "#EEEEEE", // darkStep12 — primary text
  inkSoft: "#A0A0A0", // secondary text
  inkFaint: "#8A8A8A", // AA 5.7:1 on bg — placeholders, chevrons
  accent: "#FAB283", // darkStep9 — opencode signature peach
  accentSoft: "#33261C", // peach tint backgrounds
  accentDeep: "#FFC09F", // darkStep10 — brighter peach on dark
  trackOff: "#323232",
  serif: FONT_SERIF,
  body: FONT_BODY,
  mono: FONT_MONO,
}

// Dark is the shipped default; light only when the OS (or the in-app
// Appearance setting) explicitly asks for it.
export function useTheme(): Theme {
  const scheme = useColorScheme()
  const appearance = useSettings((s) => s.appearance)
  const dark = appearance === "dark" || (appearance === "system" && scheme === "dark")
  return dark ? DARK : LIGHT
}
