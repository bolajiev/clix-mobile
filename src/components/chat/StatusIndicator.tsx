import { View, Text, StyleSheet } from "react-native"
import { useTranslation } from "react-i18next"
import { useEvents } from "../../stores/events"
import { useSessions } from "../../stores/sessions"
import { useTheme } from "../../theme/tokens"
import { StreamingLoader } from "./StreamingLoader"

interface Props {
  sessionID: string
  isDark: boolean
}

export function StatusIndicator({ sessionID, isDark }: Props) {
  const { t } = useTranslation()
  const theme = useTheme()
  const status = useEvents((s) => s.sessionStatus[sessionID])
  const text = useEvents((s) => s.statusText[sessionID])
  const optimistic = useSessions((s) => s.sending[sessionID])

  // SSE status is the source of truth. The optimistic `sending` flag only
  // covers the gap between the user tapping send and SSE confirming busy.
  // Once SSE reports idle, the indicator hides regardless of the optimistic flag.
  const sseBusy = status && status.type !== "idle"
  const busy = sseBusy || (optimistic && !status)
  if (!busy) return null

  const label =
    status?.type === "retry"
      ? t("chat.statusIndicator.retrying", { attempt: status.attempt })
      : text || t("chat.statusIndicator.working")

  return (
    <View style={s.bar}>
      <StreamingLoader label={label} />
    </View>
  )
}

const s = StyleSheet.create({
  bar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
})
