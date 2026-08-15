import { useMemo, useRef, useState, useCallback, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Keyboard,
  Animated,
  Easing,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from "react-native"
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTheme } from "../../theme/tokens"
import type { SlashCommand } from "./slash-commands"

export interface PromptModel {
  providerID: string
  modelID: string
}

// Rainbow stops for the model-change sweep (glimm homage — a soft rainbow
// band glides across the composer when a new model is picked).
const RAINBOW_STOPS = ["#E06C75", "#F5A742", "#E5C07B", "#7FD88F", "#56B6C2", "#5C9CF5", "#9D7CD8"]

// Animated dictation equalizer bars (the reference's eq-bounce, in RN).
function EqBars() {
  const theme = useTheme()
  const anims = useRef([new Animated.Value(1), new Animated.Value(1), new Animated.Value(1)]).current
  useEffect(() => {
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(a, { toValue: 0.35, duration: 420, useNativeDriver: true }),
          Animated.timing(a, { toValue: 1, duration: 420, useNativeDriver: true }),
        ]),
      ),
    )
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [anims])
  const heights = [10, 16, 12]
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2.5, height: 16 }}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={{
            width: 2.5,
            height: heights[i],
            borderRadius: 2,
            backgroundColor: "#ffffff",
            opacity: a,
            transform: [{ scaleY: a }],
          }}
        />
      ))}
    </View>
  )
}

interface Props {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  canSend: boolean
  isSending: boolean
  onAbort: () => void
  model: PromptModel | null
  modelLabel: string
  models: PromptModel[]
  onSelectModel: (providerID: string, modelID: string) => void
  agent: string
  onCycleAgent: () => void
  commands: SlashCommand[]
  onCommandSelect: (cmd: SlashCommand) => void
  variantLabel: string | null
  onOpenVariant: () => void
  speech: { listening: boolean; transcript: string; start: () => void; stop: () => void }
  onPickImage: () => void
  onTakePhoto: () => void
  onPasteClipboard: () => void
  /** Increments whenever the user changes the model — fires the rainbow sweep. */
  sweepSignal: number
}

type Menu = "plus" | "slash" | "model" | null

interface MenuRow {
  key: string
  title: string
  desc?: string
  icon?: string
  action: () => void
  check?: boolean
}

export function PromptBar({
  value,
  onChangeText,
  onSend,
  canSend,
  isSending,
  onAbort,
  model,
  modelLabel,
  models,
  onSelectModel,
  agent,
  onCycleAgent,
  commands,
  onCommandSelect,
  variantLabel,
  onOpenVariant,
  speech,
  onPickImage,
  onTakePhoto,
  onPasteClipboard,
  sweepSignal,
}: Props) {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const inputRef = useRef<TextInput>(null)
  const [menu, setMenu] = useState<Menu>(null)
  const [active, setActive] = useState(0)
  // Height of the composer card — the floating menus anchor above it so they
  // never overlap the input, no matter how tall it grows.
  const [composerHeight, setComposerHeight] = useState(48)
  const [composerWidth, setComposerWidth] = useState(320)

  // Rainbow sweep (glimm homage): on model change a soft rainbow band glides
  // once across the composer interior.
  const sweepX = useRef(new Animated.Value(-1)).current
  const sweepOpacity = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (sweepSignal === 0) return
    sweepX.setValue(-1)
    Animated.sequence([
      Animated.timing(sweepOpacity, { toValue: 0.5, duration: 60, useNativeDriver: true }),
      Animated.timing(sweepX, { toValue: 1, duration: 950, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(sweepOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start()
  }, [sweepSignal, sweepX, sweepOpacity])
  const sweepTranslate = sweepX.interpolate({ inputRange: [-1, 1], outputRange: [-composerWidth, composerWidth] })

  // Slash token: typing "/cmd" at the START of the input (caret right after
  // the slash) opens the command menu. Caret-aware so editing mid-word never
  // hijacks the composer.
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 })
  const slashToken =
    selection.start === 1 && value.startsWith("/") && !value.includes(" ")
      ? value.slice(1).toLowerCase()
      : null

  // Auto-open the slash menu while the user types a command. Esc dismisses it
  // until the text changes (a dismissed menu must not instantly re-open).
  const slashDismissedRef = useRef(false)
  useEffect(() => {
    if (slashToken === null) {
      slashDismissedRef.current = false
      if (menu === "slash") setMenu(null)
      return
    }
    if (slashDismissedRef.current) return
    if (menu !== "slash") {
      setMenu("slash")
      setActive(0)
    }
  }, [slashToken, menu])

  const plusRows: MenuRow[] = useMemo(
    () => [
      { key: "photos", title: t("session.promptbar.addPhotos"), desc: t("session.promptbar.addPhotosDesc"), icon: "image-outline", action: onPickImage },
      { key: "camera", title: t("session.promptbar.takePhoto"), desc: t("session.promptbar.takePhotoDesc"), icon: "camera-outline", action: onTakePhoto },
      { key: "paste", title: t("session.promptbar.pasteClipboard"), desc: t("session.promptbar.pasteClipboardDesc"), icon: "clipboard-outline", action: onPasteClipboard },
    ],
    [t, onPickImage, onTakePhoto, onPasteClipboard],
  )

  const slashRows: MenuRow[] = useMemo(
    () =>
      commands
        .filter((c) => c.trigger.toLowerCase().startsWith(slashToken ?? ""))
        .map((c) => ({ key: c.trigger, title: c.trigger, desc: c.description, icon: c.icon, action: () => onCommandSelect(c) })),
    [commands, slashToken, onCommandSelect],
  )

  const modelRows: MenuRow[] = useMemo(
    () => [
      ...models.map((m) => ({
        key: `${m.providerID}/${m.modelID}`,
        title: m.modelID.split("/").pop() || m.modelID,
        desc: m.providerID,
        action: () => onSelectModel(m.providerID, m.modelID),
        check: model?.providerID === m.providerID && model?.modelID === m.modelID,
      })),
    ],
    [models, model, onSelectModel],
  )

  const activeRows: MenuRow[] = menu === "plus" ? plusRows : menu === "slash" ? slashRows : menu === "model" ? modelRows : []
  // The slash menu shows even with zero matches (with a "no matches" row);
  // plus/model menus always have rows.
  const menuVisible = menu === "slash" ? slashToken !== null : menu !== null && activeRows.length > 0

  const closeMenu = useCallback(() => setMenu(null), [])
  const openMenu = useCallback(
    (next: Menu) => {
      setMenu((current) => (current === next ? null : next))
      setActive(0)
    },
    [],
  )

  const pickRow = useCallback(
    (row: MenuRow) => {
      row.action()
      closeMenu()
      inputRef.current?.focus()
    },
    [closeMenu],
  )

  const onKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const key = e.nativeEvent.key
    if (menuVisible && activeRows.length === 0) return // no rows: never crash on nav/enter
    if (menuVisible && (key === "ArrowDown" || key === "ArrowUp")) {
      e.preventDefault?.()
      setActive((a) => (a + (key === "ArrowDown" ? 1 : activeRows.length - 1)) % activeRows.length)
      return
    }
    if (menuVisible && (key === "Enter" || key === "Tab")) {
      e.preventDefault?.()
      pickRow(activeRows[active])
      return
    }
    if (key === "Escape") {
      slashDismissedRef.current = slashToken !== null
      closeMenu()
      return
    }
  }

  const typing = value.trim().length > 0
  const showSend = typing || canSend
  const showStop = isSending && !typing
  const showMic = !isSending && !typing && !speech.listening
  const showListening = speech.listening

  const sendAction = () => {
    closeMenu()
    if (isSending && !typing && !canSend) onAbort()
    else if (canSend || typing) onSend()
  }

  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: Math.max(insets.bottom, 8) }}>
      {/* Menus float above the composer, anchored to its measured height */}
      {menuVisible && (
        <View
          style={[
            styles.menuWrap,
            { backgroundColor: theme.card, borderColor: theme.line, bottom: composerHeight + 44 },
          ]}
        >
          <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="always">
            {menu === "slash" && activeRows.length === 0 ? (
              <View style={styles.menuRow}>
                <View style={{ width: 20 }} />
                <Text style={[styles.menuTitle, { color: theme.inkFaint }]}>
                  {t("session.promptbar.noMatches", { query: slashToken || "" })}
                </Text>
              </View>
            ) : null}
            {activeRows.map((row, i) => (
              <TouchableOpacity
                key={row.key}
                style={[
                  styles.menuRow,
                  i === active && { backgroundColor: theme.accentSoft },
                ]}
                onPress={() => pickRow(row)}
                onPressIn={() => setActive(i)}
              >
                {row.icon ? (
                  <Ionicons name={row.icon as any} size={15} color={theme.inkSoft} style={{ width: 20 }} />
                ) : (
                  <View style={{ width: 20 }} />
                )}
                <Text style={[styles.menuTitle, { color: theme.ink }]} numberOfLines={1}>
                  {row.title}
                </Text>
                {row.desc ? (
                  <Text style={[styles.menuDesc, { color: theme.inkFaint }]} numberOfLines={1}>
                    {row.desc}
                  </Text>
                ) : null}
                {row.check ? (
                  <Ionicons name="checkmark" size={15} color={theme.accentDeep} />
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={[styles.menuFooter, { borderTopColor: theme.line }]}>
            <Text style={{ fontSize: 11, color: theme.inkFaint }}>{t("session.promptbar.menuHint")}</Text>
          </View>
        </View>
      )}

      {/* Agent pill — ALWAYS rendered so the composer never jumps when a menu
          opens (the pills row reserves its space; hiding it shifted the input
          up ~30px while typing "/" — the "text moves up" bug). */}
      <View style={styles.pillRow}>
        <TouchableOpacity style={[styles.pill, { backgroundColor: theme.cream2 }]} onPress={onCycleAgent} onLongPress={onCycleAgent}>
          <View style={[styles.agentDot, { backgroundColor: theme.accent }]} />
          <Text style={[styles.pillText, { color: theme.inkSoft }]}>{agent || "build"}</Text>
        </TouchableOpacity>
        {variantLabel ? (
          <TouchableOpacity style={[styles.pill, { backgroundColor: theme.accentSoft }]} onPress={onOpenVariant}>
            <Text style={[styles.pillText, { color: theme.accentDeep, fontWeight: "700" }]}>{variantLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Composer card */}
      <View
        onLayout={(e) => {
          setComposerHeight(e.nativeEvent.layout.height)
          setComposerWidth(e.nativeEvent.layout.width)
        }}
        style={[
          styles.composer,
          { backgroundColor: theme.card, borderColor: speech.listening ? "#ef4444" : theme.line },
        ]}
      >
        {/* Rainbow sweep layer (glimm homage) — glides across on model change */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            width: composerWidth,
            opacity: sweepOpacity,
            transform: [{ translateX: sweepTranslate }],
          }}
        >
          <Svg width={composerWidth} height="100%">
            <Defs>
              <LinearGradient id="rainbow" x1="0" y1="0" x2="1" y2="0">
                {RAINBOW_STOPS.map((c, i) => (
                  <Stop key={i} offset={i / (RAINBOW_STOPS.length - 1)} stopColor={c} stopOpacity="0.35" />
                ))}
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={composerWidth} height="100%" fill="url(#rainbow)" />
          </Svg>
        </Animated.View>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.roundBtn, menu === "plus" && { backgroundColor: theme.accentSoft }]}
            onPress={() => openMenu("plus")}
            accessibilityRole="button"
            accessibilityLabel="Add photos or files"
          >
            <Ionicons name="add" size={20} color={menu === "plus" ? theme.accentDeep : theme.inkSoft} />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={[styles.input, { color: theme.ink }, speech.listening && { color: "#ef4444" }]}
            placeholder={
              speech.listening
                ? t("session.input.placeholderListening")
                : isSending
                  ? t("session.input.placeholderFollowUp")
                  : t("session.input.placeholderDefault")
            }
            placeholderTextColor={speech.listening ? "#ef4444" : theme.inkFaint}
            value={speech.listening ? speech.transcript : value}
            onChangeText={speech.listening ? undefined : onChangeText}
            onFocus={closeMenu}
            editable={!speech.listening}
            multiline
            maxLength={10000}
            onKeyPress={onKeyPress}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            testID="chat-message-input"
          />

          <TouchableOpacity
            style={[styles.roundBtn, menu === "model" && { backgroundColor: theme.accentSoft }]}
            onPress={() => openMenu("model")}
            testID="model-chip"
            accessibilityRole="button"
            accessibilityLabel="Choose model"
          >
            <Text
              style={[styles.modelBtnText, { color: menu === "model" ? theme.accentDeep : theme.inkSoft }]}
              numberOfLines={1}
            >
              {modelLabel}
            </Text>
            <Ionicons name="chevron-down" size={11} color={menu === "model" ? theme.accentDeep : theme.inkFaint} />
          </TouchableOpacity>

          {showMic && (
            <TouchableOpacity style={[styles.roundBtn, { backgroundColor: theme.cream2 }]} onPress={speech.start} accessibilityRole="button" accessibilityLabel="Start dictation">
              <Ionicons name="mic" size={17} color={theme.inkSoft} />
            </TouchableOpacity>
          )}
          {showListening && (
            <TouchableOpacity style={[styles.roundBtn, { backgroundColor: "#ef4444" }]} onPress={speech.stop} accessibilityRole="button" accessibilityLabel="Stop dictation">
              <EqBars />
            </TouchableOpacity>
          )}
          {showStop && (
            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: "#ef4444" }]} onPress={sendAction} accessibilityRole="button" accessibilityLabel="Stop agent">
              <Ionicons name="stop" size={16} color="#ffffff" />
            </TouchableOpacity>
          )}
          {showSend && !showListening && (
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: canSend ? theme.ink : theme.inkFaint }]}
              onPress={sendAction}
              disabled={!canSend && !typing}
              testID="chat-send-button"
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <Ionicons name="arrow-up" size={17} color={canSend ? theme.cream : "#FFFFFF"} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  menuWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 30,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuTitle: { fontSize: 13, fontWeight: "500", maxWidth: "55%" },
  menuDesc: { flex: 1, fontSize: 11.5, textAlign: "right" },
  menuFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
  },
  pillRow: { flexDirection: "row", gap: 6, paddingHorizontal: 6, paddingBottom: 6 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  agentDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: "600" },
  composer: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 6,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  roundBtn: {
    height: 44,
    minWidth: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    flexDirection: "row",
    gap: 3,
  },
  modelBtnText: { fontSize: 13, fontWeight: "700", maxWidth: 120 },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 11,
    paddingHorizontal: 4,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  eqRow: { flexDirection: "row", alignItems: "center", gap: 2.5, height: 14 },
  eqBar: { width: 2.5, borderRadius: 2, opacity: 0.9 },
})
