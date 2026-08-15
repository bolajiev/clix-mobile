import { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useTheme } from "../../theme/tokens"

interface Props {
  text: string
  isDark: boolean
}

// P4: reasoning collapses into a chip ("Thought…") instead of a visible
// block; tap to expand inline.
export function ReasoningBlock({ text, isDark }: Props) {
  const { t } = useTranslation()
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)

  return (
    <View style={{ marginBottom: 8 }}>
      <TouchableOpacity
        style={[s.chip, { backgroundColor: theme.accentSoft }]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t("chat.reasoningBlock.label")}
      >
        <Ionicons name="sparkles-outline" size={12} color={theme.accentDeep} />
        <Text style={[s.label, { color: theme.accentDeep }]}>{t("chat.reasoningBlock.label")}</Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={12} color={theme.inkFaint} />
      </TouchableOpacity>
      {expanded && (
        <Text style={[s.text, { color: theme.inkSoft }]} selectable>
          {text}
        </Text>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: { fontSize: 11.5, fontWeight: "600" },
  text: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 2,
  },
})
