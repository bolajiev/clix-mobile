import { useEffect, useMemo, useRef, useState } from "react"
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  Animated,
  Easing,
} from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useSessions } from "../src/stores/sessions"
import { RefreshControl } from "react-native"
import { useConnections } from "../src/stores/connections"
import { useEvents } from "../src/stores/events"
import { useTheme } from "../src/theme/tokens"
import { groupByDirectory } from "../src/lib/session-grouping"
import { DirectorySwitcher, DirectoryBrowserSheet } from "../src/components/chat"
import type BottomSheet from "@gorhom/bottom-sheet"
import { useCatalog } from "../src/stores/catalog"
import type { Session } from "../src/lib/sdk"
import { Modal, TextInput, Alert } from "react-native"

const PROJECT_DOTS = ["#FAB283", "#8A9A7B", "#7B8FA1", "#B48EAD", "#C9A24B"]

function dotFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return PROJECT_DOTS[h % PROJECT_DOTS.length]
}

function shortDir(dir: string): string {
  if (!dir || dir === "/") return "root"
  const parts = dir.split("/").filter(Boolean)
  return parts[parts.length - 1]
}

function formatTime(timestamp: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - timestamp
  if (diff < 60000) return t("sessionsList.time.justNow")
  if (diff < 3600000) return t("sessionsList.time.minutesAgo", { count: Math.floor(diff / 60000) })
  if (diff < 86400000) return t("sessionsList.time.hoursAgo", { count: Math.floor(diff / 3600000) })
  if (diff < 604800000) return t("sessionsList.time.daysAgo", { count: Math.floor(diff / 86400000) })
  return new Date(timestamp).toLocaleDateString()
}

export default function HomeScreen() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const { sessions, loadSessions, createSession, selectSession, deleteSession, renameSession } = useSessions()
  const activeConnection = useConnections((s) => s.activeConnection)
  const sseConnected = useEvents((s) => s.connected)
  const { switchDirectory, serverHome, recentDirectories } = useConnections()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const loadedRef = useRef(false)
  const dirSheetRef = useRef<BottomSheet>(null)
  const browserSheetRef = useRef<BottomSheet>(null)
  const [renameTarget, setRenameTarget] = useState<Session | null>(null)
  const [renameValue, setRenameValue] = useState("")
  // Drawer slide + scrim fade (HIG: natural motion, ~280ms ease)
  const drawerAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(drawerAnim, {
      toValue: drawerOpen ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [drawerOpen, drawerAnim])

  const drawerTranslate = drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [-400, 0] })
  const scrimOpacity = drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] })

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true
      void loadSessions()
    }
  }, [loadSessions])

  const groups = useMemo(() => groupByDirectory(sessions), [sessions])
  const count = sessions.length
  const connected = Boolean(activeConnection && sseConnected)

  // D1 (architecture): the most recently updated session in each project is
  // "the current session" — the one the terminal/web resume, and the one the
  // app continues. Highlight it per group and send into it; a message sent
  // from the phone lands in the same conversation the terminal is watching.
  const currentByDir = useMemo(() => {
    const map = new Map<string, string>()
    for (const group of groups) {
      const latest = [...group.items].sort(
        (a, b) => (b.time?.updated ?? b.time?.created ?? 0) - (a.time?.updated ?? a.time?.created ?? 0),
      )[0]
      if (latest) map.set(group.directory ?? "", latest.id)
    }
    return map
  }, [groups])

  const onNewSession = async () => {
    if (creating) return
    setCreating(true)
    try {
      const session = await createSession()
      if (session) {
        closeDrawer()
        router.push({ pathname: "/session/[id]", params: { id: session.id, ...(session.directory ? { directory: session.directory } : {}) } })
      }
    } finally {
      setCreating(false)
    }
  }

  const openSession = async (id: string, directory?: string) => {
    closeDrawer()
    // Push FIRST with the directory in params — the session screen re-selects
    // on focus using those params, and without directory it falls back to the
    // active-connection client (wrong client for cross-project sessions).
    // Pushing before awaiting selectSession also guarantees rapid taps land
    // on the LAST-tapped session (no stale navigation from a slow resolve).
    router.push({ pathname: "/session/[id]", params: { id, ...(directory ? { directory } : {}) } })
    try {
      await selectSession(id, directory)
    } catch {
      // selectSession surfaces its own error state
    }
  }

  const closeDrawer = () => setDrawerOpen(false)

  const currentDir = activeConnection?.directory || undefined

  const handleSwitchDirectory = async (dir?: string) => {
    try {
      await switchDirectory(dir)
      void loadSessions()
      void useCatalog.getState().load()
    } catch {
      // switchDirectory surfaces its own error
    }
  }

  const handleBrowseSelect = (directory: string) => {
    void handleSwitchDirectory(directory)
  }

  const onLongPressSession = (session: Session) => {
    Alert.alert(session.title || session.slug, undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("home.rename"),
        onPress: () => {
          setRenameTarget(session)
          setRenameValue(session.title || session.slug || "")
        },
      },
      { text: t("common.delete"), style: "destructive", onPress: () => void deleteSession(session.id) },
    ])
  }

  const TEMPLATES = [
    { label: t("home.templates.refactor"), prompt: t("home.templates.refactorPrompt") },
    { label: t("home.templates.explain"), prompt: t("home.templates.explainPrompt") },
    { label: t("home.templates.tests"), prompt: t("home.templates.testsPrompt") },
    { label: t("home.templates.fix"), prompt: t("home.templates.fixPrompt") },
  ]

  const onTemplate = async (prompt: string) => {
    if (creating) return
    setCreating(true)
    try {
      const session = await createSession()
      if (session) {
        closeDrawer()
        router.push({
          pathname: "/session/[id]",
          params: { id: session.id, ...(session.directory ? { directory: session.directory } : {}), prompt },
        })
      }
    } finally {
      setCreating(false)
    }
  }

  // Android hardware back closes the drawer first instead of exiting the app.
  useEffect(() => {
    if (!drawerOpen) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeDrawer()
      return true
    })
    return () => sub.remove()
  }, [drawerOpen])

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      {/* Top bar: hamburger + centered wordmark + mirrored spacer */}
      <View style={[styles.appbar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.iconbtn} onPress={() => setDrawerOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Open menu">
          <Ionicons name="menu" size={24} color={theme.ink} />
        </TouchableOpacity>
        <Text style={[styles.wordmark, { color: theme.ink }]}>Clix</Text>
        <View style={styles.iconbtn} />
      </View>

      {/* Connection pill — real state only */}
      <View style={styles.pillRow}>
        <View style={styles.pillRowInner}>
          <TouchableOpacity
            style={[styles.statuspill, { backgroundColor: theme.card, borderColor: theme.line }]}
            onPress={() => dirSheetRef.current?.expand()}
            accessibilityRole="button"
            accessibilityLabel="Switch project folder"
          >
            <Ionicons name="folder-outline" size={13} color={theme.accentDeep} />
            <Text style={[styles.statusText, { color: theme.inkSoft }]} numberOfLines={1}>
              {currentDir ? shortDir(currentDir) : t("home.defaultDir")}
            </Text>
            <Ionicons name="chevron-down" size={12} color={theme.inkFaint} />
          </TouchableOpacity>
          <View style={[styles.statuspill, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <View style={[styles.pulse, { backgroundColor: connected ? theme.accent : theme.trackOff }]} />
            <Text style={[styles.statusText, { color: connected ? theme.inkSoft : theme.inkFaint }]}>
              {connected ? t("home.connected") : t("home.notConnected")}
            </Text>
          </View>
        </View>
      </View>

      {/* Sessions grouped by project */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.sessionList}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => void loadSessions()}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        {groups.length === 0 ? (
          <View style={styles.center}>
            <View style={[styles.glyph, { backgroundColor: theme.accentSoft }]}>
              <Text style={{ fontFamily: theme.serif, fontWeight: "700", fontSize: 28, color: theme.accentDeep }}>C</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: theme.ink }]}>{t("home.emptyTitle")}</Text>
            <Text style={[styles.emptySub, { color: theme.inkSoft }]}>{t("home.emptySub")}</Text>
            <View style={styles.templateRow}>
              {TEMPLATES.map((tmpl) => (
                <TouchableOpacity
                  key={tmpl.label}
                  style={[styles.templateChip, { backgroundColor: theme.card, borderColor: theme.line }]}
                  onPress={() => void onTemplate(tmpl.prompt)}
                  disabled={creating}
                >
                  <Text style={[styles.templateText, { color: theme.accentDeep }]}>{tmpl.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.directory || "root"}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupDot, { backgroundColor: dotFor(group.directory || "root") }]} />
                <Text style={[styles.groupLabel, { color: theme.inkFaint }]} numberOfLines={1}>
                  {shortDir(group.directory || "/")}
                </Text>
                <Text style={[styles.groupCount, { color: theme.inkFaint }]}>{group.items.length}</Text>
              </View>
              {group.items.map((session) => {
                const isCurrent = currentByDir.get(group.directory ?? "") === session.id
                return (
                  <TouchableOpacity
                    key={session.id}
                    style={[
                      styles.sessionItem,
                      { backgroundColor: theme.card, borderColor: isCurrent ? theme.accent : theme.line },
                    ]}
                    onPress={() => openSession(session.id, session.directory)}
                  >
                    <View style={[styles.sessionGlyph, { backgroundColor: isCurrent ? theme.accentSoft : theme.cream2 }]}>
                      <Ionicons
                        name={isCurrent ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"}
                        size={16}
                        color={isCurrent ? theme.accentDeep : theme.inkSoft}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[styles.sessionTitle, { color: isCurrent ? theme.accentDeep : theme.ink }]}
                        numberOfLines={1}
                      >
                        {session.title || session.slug}
                      </Text>
                      <Text style={[styles.sessionSub, { color: theme.inkFaint }]}>
                        {session.time?.created ? formatTime(session.time.created, t) : ""}
                      </Text>
                    </View>
                    {isCurrent ? (
                      <Text style={[styles.currentTag, { color: theme.accentDeep, backgroundColor: theme.accentSoft }]}>
                        {t("home.current")}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                )
              })}
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.accent, bottom: insets.bottom + 88 }]}
        onPress={onNewSession}
        activeOpacity={0.85}
      >
        {creating ? (
          <ActivityIndicator size="small" color="#0A0A0A" />
        ) : (
          <Ionicons name="add" size={28} color="#0A0A0A" />
        )}
      </TouchableOpacity>

      {/* Bottom bar — settings only */}
      <View style={[styles.accountbar, { borderTopColor: theme.line, paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={styles.iconbtn} onPress={() => router.push("/settings")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Settings">
          <Ionicons name="settings-outline" size={22} color={theme.ink} />
        </TouchableOpacity>
      </View>

      {/* Drawer + scrim */}
      <Animated.View
        style={[styles.scrim, { opacity: scrimOpacity, backgroundColor: "#000000" }]}
        onTouchStart={closeDrawer}
        pointerEvents={drawerOpen ? "auto" : "none"}
      />
      <Animated.View
        style={[
          styles.drawer,
          { backgroundColor: theme.card, paddingTop: insets.top, transform: [{ translateX: drawerTranslate }] },
        ]}
      >
        <View style={styles.drawerHead}>
          <Text style={[styles.wordmark, { color: theme.ink }]}>Clix</Text>
          <TouchableOpacity style={styles.iconbtn} onPress={closeDrawer} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close menu">
            <Ionicons name="close" size={22} color={theme.ink} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.drawerAction} onPress={onNewSession}>
          <Ionicons name="add" size={18} color={theme.accentDeep} />
          <Text style={[styles.drawerActionText, { color: theme.accentDeep }]}>{t("home.newSession")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.drawerLink} onPress={() => { closeDrawer(); router.push("/connections") }}>
          <Ionicons name="server-outline" size={18} color={theme.ink} />
          <Text style={[styles.drawerLinkText, { color: theme.ink }]}>{t("home.connections")}</Text>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: theme.line }]} />

        <Text style={[styles.drawerLabel, { color: theme.inkFaint }]}>{t("home.sessionsLabel", { count })}</Text>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }}>
          {groups.map((group) => (
            <View key={group.directory || "root"}>
              <Text style={[styles.drawerGroupLabel, { color: theme.inkFaint }]} numberOfLines={1}>
                {shortDir(group.directory || "/")}
              </Text>
              {group.items.map((session) => (
                <TouchableOpacity
                  key={session.id}
                  style={[styles.drawerRow, { backgroundColor: "transparent" }]}
                  onPress={() => openSession(session.id, session.directory)}
                  onLongPress={() => onLongPressSession(session)}
                  delayLongPress={400}
                >
                  <View style={[styles.drawerDot, { backgroundColor: dotFor(session.directory || session.id) }]} />
                  <Text
                    style={[styles.drawerName, { color: theme.inkSoft }]}
                    numberOfLines={1}
                  >
                    {session.title || session.slug}
                  </Text>
                  <Text style={[styles.drawerCount, { color: theme.inkFaint }]}>
                    {session.time?.created ? formatTime(session.time.created, t) : ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          {sessions.length === 0 && !creating ? (
            <Text style={[styles.drawerEmpty, { color: theme.inkFaint }]}>{t("home.noSessions")}</Text>
          ) : null}
        </ScrollView>

        <View style={[styles.drawerFoot, { borderTopColor: theme.line, paddingBottom: insets.bottom + 14 }]}>
          <TouchableOpacity style={styles.iconbtn} onPress={() => { closeDrawer(); router.push("/settings") }} hitSlop={8}>
            <Ionicons name="settings-outline" size={22} color={theme.ink} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Directory switcher + browser sheets */}
      <DirectorySwitcher
        sheetRef={dirSheetRef}
        current={currentDir}
        recents={recentDirectories}
        serverHome={serverHome}
        isDark={theme.dark}
        onSwitch={handleSwitchDirectory}
        onBrowse={() => browserSheetRef.current?.expand()}
      />
      <DirectoryBrowserSheet
        sheetRef={browserSheetRef}
        startDirectory={currentDir || serverHome || null}
        clientForDirectory={useConnections.getState().clientForDirectory}
        isDark={theme.dark}
        onSelect={handleBrowseSelect}
      />

      {/* Rename modal (Android has no Alert.prompt) */}
      <Modal visible={renameTarget !== null} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <Text style={[styles.modalTitle, { color: theme.ink }]}>{t("home.renameTitle")}</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.cream2, color: theme.ink }]}
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              onSubmitEditing={() => {
                if (renameTarget) void renameSession(renameTarget.id, renameValue)
                setRenameTarget(null)
              }}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: theme.cream2 }]} onPress={() => setRenameTarget(null)}>
                <Text style={{ color: theme.inkSoft, fontWeight: "600" }}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.accent }]}
                onPress={() => {
                  if (renameTarget) void renameSession(renameTarget.id, renameValue)
                  setRenameTarget(null)
                }}
              >
                <Text style={{ color: "#0A0A0A", fontWeight: "700" }}>{t("home.rename")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  appbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  iconbtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  wordmark: { fontFamily: "SourceSerif4_700Bold", fontSize: 21, letterSpacing: -0.2 },
  pillRow: { paddingHorizontal: 16, paddingTop: 8 },
  pillRowInner: { flexDirection: "row", gap: 8, justifyContent: "center", flexWrap: "wrap" },
  templateRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 8 },
  templateChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  templateText: { fontSize: 12.5, fontWeight: "600" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 32 },
  modalCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  modalTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  modalInput: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  modalBtns: { flexDirection: "row", gap: 8, marginTop: 14, justifyContent: "flex-end" },
  modalBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  statuspill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  pulse: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12.5, fontWeight: "600" },
  sessionList: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 96 },
  center: { alignItems: "center", gap: 12, paddingTop: 90 },
  glyph: { width: 76, height: 76, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: "SourceSerif4_600SemiBold", fontSize: 22, textAlign: "center" },
  emptySub: { fontSize: 13.5, textAlign: "center" },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 6,
  },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupLabel: { flex: 1, fontSize: 12, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  groupCount: { fontSize: 11.5, fontWeight: "600" },
  sessionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  sessionGlyph: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sessionTitle: { fontSize: 15, fontWeight: "600" },
  sessionSub: { fontSize: 11.5, marginTop: 2 },
  currentTag: {
    fontSize: 11,
    fontWeight: "700",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: "hidden",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 92,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  accountbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  scrim: { ...StyleSheet.absoluteFillObject, zIndex: 40 },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: "82%",
    maxWidth: 320,
    zIndex: 50,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    transform: [{ translateX: -400 }],
  },
  drawerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18 },
  drawerAction: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingVertical: 12 },
  drawerActionText: { fontFamily: "Inter_600SemiBold", fontSize: 14.5 },
  drawerLink: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingVertical: 11 },
  drawerLinkText: { fontSize: 14.5, fontWeight: "500" },
  divider: { height: 1, marginHorizontal: 18, marginVertical: 8 },
  drawerLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", paddingHorizontal: 18, paddingVertical: 7 },
  drawerGroupLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 4,
  },
  drawerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingVertical: 10 },
  drawerDot: { width: 9, height: 9, borderRadius: 5 },
  drawerName: { flex: 1, fontSize: 13.5, fontWeight: "500" },
  drawerCount: { fontSize: 11.5, fontVariant: ["tabular-nums"] },
  drawerEmpty: { fontSize: 13, paddingHorizontal: 18, paddingTop: 8 },
  drawerFoot: { borderTopWidth: 1, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
})
