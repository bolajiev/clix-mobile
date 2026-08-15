import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from "react-native"
import { router } from "expo-router"
import { useTranslation } from "react-i18next"
import { useConnections } from "../src/stores/connections"
import { useSettings } from "../src/stores/settings"
import { useTheme } from "../src/theme/tokens"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { Badge, Group, GroupLabel, Row, ScreenHeader, Segmented } from "../src/components/ui"

const PAGE_SIZES = [10, 25, 50, 100, 200] as const

export default function ConnectionsScreen() {
  const insets = useSafeAreaInsets()
  const theme = useTheme()
  const { t } = useTranslation()
  const { connections, activeConnection, setActiveConnection, removeConnection } = useConnections()
  const { pageSize, setPageSize } = useSettings()

  const onLongPress = (id: string) => {
    Alert.alert(t("connectionsList.actionsAlert.title"), t("connectionsList.actionsAlert.message"), [
      { text: t("connectionsList.actionsAlert.edit"), onPress: () => router.push(`/connection/${id}`) },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => removeConnection(id),
      },
      { text: t("common.cancel"), style: "cancel" },
    ])
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <ScreenHeader title={t("connectionsList.title")} onBack={() => router.back()} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 + insets.bottom }}>
        {/* Active connection card */}
        <View style={[styles.conncard, { backgroundColor: theme.card, borderColor: theme.accent }]}>
          <View style={[styles.bigChip, { backgroundColor: theme.accentSoft }]}>
            <Ionicons name="cloud-outline" size={20} color={theme.accentDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
              <Text style={[styles.connTitle, { color: theme.ink }]} numberOfLines={1}>
                {activeConnection?.name || t("connectionsList.noActive")}
              </Text>
              {activeConnection ? <Badge label={t("connectionsList.connected")} /> : null}
            </View>
            <Text style={[styles.mono, { color: theme.inkSoft }]} numberOfLines={1}>
              {activeConnection?.url || ""}
            </Text>
            <View style={styles.latRow}>
              <View style={[styles.latDot, { backgroundColor: activeConnection ? theme.accent : theme.trackOff }]} />
              <Text style={[styles.latText, { color: theme.inkFaint }]}>
                {activeConnection ? t("connectionsList.responding") : t("connectionsList.notConnected")}
              </Text>
            </View>
          </View>
        </View>

        {/* Other connections */}
        {connections.filter((c) => c.id !== activeConnection?.id).length > 0 && (
          <>
            <GroupLabel label={t("connectionsList.others")} />
            <Group>
              {connections
                .filter((c) => c.id !== activeConnection?.id)
                .map((connection, i, arr) => (
                  <Row
                    key={connection.id}
                    icon={<Ionicons name="home-outline" size={18} color={theme.accentDeep} />}
                    title={connection.name}
                    subtitle={connection.url?.replace(/^https?:\/\//, "") || ""}
                    right={<Text style={{ fontSize: 15, color: theme.accentDeep }}>{t("connectionsList.use")}</Text>}
                    onPress={() => setActiveConnection(connection.id)}
                    onLongPress={() => onLongPress(connection.id)}
                    last={i === arr.length - 1}
                  />
                ))}
            </Group>
          </>
        )}

        {/* Preferences */}
        <GroupLabel label={t("connectionsList.preferences")} />
        <Group>
          <View style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
            <Text style={{ fontSize: 14.5, fontWeight: "600", color: theme.ink, marginBottom: 8 }}>
              {t("connectionsList.preferences.pageSizeLabel")}
            </Text>
            <Segmented options={[...PAGE_SIZES]} value={pageSize} onChange={(size) => setPageSize(size)} />
            <Text style={[styles.helper, { color: theme.inkFaint }]}>{t("connectionsList.pageSizeHelper")}</Text>
          </View>
        </Group>

        {/* Tip card */}
        <View style={[styles.tipcard, { borderColor: theme.line }]}>
          <Ionicons name="bulb-outline" size={16} color={theme.accentDeep} style={{ marginRight: 8 }} />
          <Text style={[styles.tipText, { color: theme.inkSoft }]}>{t("connectionsList.tip")}</Text>
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.accent }]}
        onPress={() => router.push("/connection/add")}
        activeOpacity={0.85}
      >
        <Text style={styles.fabPlus}>＋</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  conncard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    flexDirection: "row",
    gap: 13,
    alignItems: "flex-start",
  },
  bigChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  connTitle: { fontSize: 15.5, fontWeight: "700", marginRight: 8, flexShrink: 1 },
  mono: { fontFamily: "IBMPlexMono_400Regular", fontSize: 12, marginTop: 3 },
  latRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  latDot: { width: 7, height: 7, borderRadius: 4 },
  latText: { fontSize: 12 },
  chipText: { fontSize: 16 },
  helper: { fontSize: 12, marginTop: 8, lineHeight: 17 },
  tipcard: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  tipText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  fabPlus: { color: "#FFFFFF", fontSize: 26, lineHeight: 30 },
})
