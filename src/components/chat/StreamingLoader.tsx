import { useEffect, useRef, useState } from "react"
import { Animated, View, Text, StyleSheet, Easing } from "react-native"
import { useTheme } from "../../theme/tokens"

// Pixel-grid wavefront loader (beautifului "LoadingState" grammar):
// 9 cells light up in a chevron sweep; label shimmers; elapsed ticks in
// mono tabular figures. Used while the agent is working with no output yet.

const CHEVRON_DELAYS = [0, 90, 180, 90, 180, 270, 180, 270, 360]
const DUR_MS = 650

function useElapsed() {
  const [ds, setDs] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setDs((d) => d + 1), 100)
    return () => clearInterval(t)
  }, [])
  const total = ds / 10
  if (total < 60) return `${total.toFixed(1)}s`
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`
}

function Pixel({ delay, color }: { delay: number; color: string }) {
  const opacity = useRef(new Animated.Value(0.15)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 0.9, duration: DUR_MS * 0.5, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.15, duration: DUR_MS * 0.5, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity, delay])
  return <Animated.View style={[styles.cell, { backgroundColor: color, opacity }]} />
}

export function StreamingLoader({ label }: { label: string }) {
  const theme = useTheme()
  const elapsed = useElapsed()
  return (
    <View style={styles.row}>
      <View style={styles.grid}>
        {CHEVRON_DELAYS.map((delay, i) => (
          <Pixel key={i} delay={delay} color={theme.ink} />
        ))}
      </View>
      <Text style={[styles.label, { color: theme.inkSoft }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.elapsed, { color: theme.inkFaint }]}>{elapsed}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 },
  grid: {
    width: 16,
    height: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 1.5,
  },
  cell: { width: 4, height: 4, borderRadius: 1 },
  label: { fontSize: 13, fontWeight: "500", maxWidth: 160 },
  elapsed: { fontSize: 12, fontVariant: ["tabular-nums"] },
})
