import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useTheme } from "../../theme/tokens"

interface Props {
  permission: { id: string; permission: string; patterns: string[] }
  isDark: boolean
  onReply: (reply: "once" | "always" | "reject") => void
}

export function PermissionPrompt({ permission, isDark, onReply }: Props) {
  const { t } = useTranslation()
  const theme = useTheme()
  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <View style={s.header}>
        <View style={[s.iconChip, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="shield-outline" size={17} color={theme.accentDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: theme.ink }]}>{t("chat.permissionPrompt.title")}</Text>
          <Text style={[s.type, { color: theme.inkSoft }]} numberOfLines={2}>
            {permission.permission}: {permission.patterns.join(", ")}
          </Text>
        </View>
      </View>
      <View style={s.actions}>
        <TouchableOpacity style={[s.btn, { backgroundColor: theme.cream2 }]} onPress={() => onReply("reject")}>
          <Text style={[s.denyText, { color: theme.inkSoft }]}>{t("chat.permissionPrompt.deny")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { backgroundColor: theme.ink }]} onPress={() => onReply("always")}>
          <Text style={[s.alwaysText, { color: theme.cream }]}>{t("chat.permissionPrompt.always")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { backgroundColor: theme.accent }]} onPress={() => onReply("once")}>
          <Text style={[s.allowText, { color: "#FFFFFF" }]}>{t("chat.permissionPrompt.allow")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#3D3929",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  iconChip: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 14, fontWeight: "700" },
  type: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  actions: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  denyText: { fontWeight: "700", fontSize: 13 },
  alwaysText: { fontWeight: "700", fontSize: 13 },
  allowText: { fontWeight: "700", fontSize: 13 },
})
