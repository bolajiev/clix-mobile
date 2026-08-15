import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle, type StyleProp } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme, type Theme } from "../../theme/tokens"

function t(theme: Theme, key: string) {
  return theme[key as keyof Theme] as string
}

/** 44×26 pill toggle — off = trackOff, on = accent, white knob, ~150ms slide. */
export function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle?: () => void; disabled?: boolean }) {
  const theme = useTheme()
  return (
    <TouchableOpacity
      onPress={onToggle}
      disabled={disabled}
      activeOpacity={0.8}
      style={[styles.toggle, { backgroundColor: on ? theme.accent : theme.trackOff }, disabled && styles.disabled]}
    >
      <View style={[styles.knob, { left: on ? 21 : 3 }]} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 999,
    justifyContent: "center",
  },
  knob: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  disabled: { opacity: 0.55 },
})

/** 38×38 accent-soft icon chip. */
export function IconChip({ children, size = 38 }: { children: React.ReactNode; size?: number }) {
  const theme = useTheme()
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        backgroundColor: theme.accentSoft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  )
}

/** Small solid-accent pill, white bold text. */
export function Badge({ label }: { label: string }) {
  const theme = useTheme()
  return (
    <Text
      style={{
        backgroundColor: theme.accent,
        color: "#FFFFFF",
        fontSize: 11,
        fontWeight: "700",
        paddingHorizontal: 9,
        paddingVertical: 2.5,
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      {label}
    </Text>
  )
}

/** Accent-soft count pill (drawer session counts). */
export function CountPill({ count }: { count: number }) {
  const theme = useTheme()
  return (
    <Text
      style={{
        fontSize: 11.5,
        color: theme.accentDeep,
        backgroundColor: theme.accentSoft,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        overflow: "hidden",
        fontVariant: ["tabular-nums"],
      }}
    >
      {count}
    </Text>
  )
}

/** Pill segmented control — selected = ink fill, cream text. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
}) {
  const theme = useTheme()
  return (
    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
      {options.map((opt) => {
        const on = opt === value
        return (
          <TouchableOpacity
            key={String(opt)}
            onPress={() => onChange(opt)}
            style={{
              borderWidth: 1,
              borderColor: on ? theme.ink : theme.line,
              backgroundColor: on ? theme.ink : theme.cream2,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: "600",
                color: on ? theme.cream : theme.inkSoft,
              }}
            >
              {String(opt)}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

/** Grouped card list: white surface, hairline border, 16px radius, row dividers. */
export function Group({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme()
  return (
    <View
      style={[
        {
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: 16,
          overflow: "hidden",
          marginTop: 14,
          shadowColor: "#3D3929",
          shadowOpacity: 0.06,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function GroupLabel({ label }: { label: string }) {
  const theme = useTheme()
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.08,
        textTransform: "uppercase",
        color: theme.inkFaint,
        paddingTop: 16,
        paddingBottom: 8,
        paddingHorizontal: 4,
      }}
    >
      {label}
    </Text>
  )
}

/** Row with icon chip + title/subtitle + trailing control. */
export function Row({
  icon,
  title,
  subtitle,
  right,
  onPress,
  onLongPress,
  last,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  right?: React.ReactNode
  onPress?: () => void
  onLongPress?: () => void
  last?: boolean
}) {
  const theme = useTheme()
  const inner = (
    <>
      <IconChip>{icon}</IconChip>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14.5, fontWeight: "600", color: theme.ink }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontSize: 12, color: theme.inkSoft, marginTop: 1, lineHeight: 16 }}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </>
  )
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={onPress || onLongPress ? 0.7 : 1}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.line,
      }}
    >
      {inner}
    </TouchableOpacity>
  )
}

/** Screen header: back chevron + serif title (Claude style). */
export function ScreenHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 16,
        paddingTop: insets.top + 10,
        paddingBottom: 4,
      }}
    >
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={{ fontSize: 24, color: theme.ink, lineHeight: 26 }}>‹</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={{ flex: 1, fontFamily: theme.serif, fontSize: 22, fontWeight: "700", color: theme.ink, letterSpacing: -0.4 }}>
        {title}
      </Text>
      {right}
    </View>
  )
}
