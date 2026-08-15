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
  // Theme adopted from remote-for-opencode (DesignTokens.swift dark mode):
  // warm charcoal, not pure black; clay terracotta accent; warm off-white ink.
  cream: "#141413", // canvas
  cream2: "#1F1E1D", // surface
  card: "#262624", // surfaceRaised
  line: "#3A3834", // hairline
  ink: "#F4F0EC", // warm off-white
  inkSoft: "#B0AEA5", // muted
  inkFaint: "#87867F", // faint
  accent: "#E08A63", // clay
  accentSoft: "#33241B", // clay tint
  accentDeep: "#F0A882", // brighter clay for text on dark
  trackOff: "#3A3834",
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
