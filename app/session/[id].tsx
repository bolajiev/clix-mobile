import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import {
  View,
  Text,
  FlatList,
  Keyboard,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native"
import { useLocalSearchParams, Stack, useRouter, useFocusEffect } from "expo-router"
import { useTheme } from "../../src/theme/tokens"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import * as ImagePicker from "expo-image-picker"
import * as ImageManipulator from "expo-image-manipulator"
import * as Clipboard from "expo-clipboard"
import type BottomSheet from "@gorhom/bottom-sheet"
import type { Message, Part } from "../../src/lib/sdk"
import {
  MessageBubble,
  PermissionPrompt,
  QuestionPrompt,
  StatusIndicator,
  ModelPicker,
  VariantPicker,
  ImageAttachments,
  SessionInfo,
  type SlashCommand,
  type Attachment,
} from "../../src/components/chat"
import { PromptBar } from "../../src/components/chat/PromptBar"
import * as Haptics from "expo-haptics"
import { StreamingLoader } from "../../src/components/chat/StreamingLoader"
import { FadeUp } from "../../src/components/chat/FadeUp"
import { useSessions } from "../../src/stores/sessions"
import { isSessionActuallyIdle } from "../../src/lib/session-status-reconcile"
import { useEvents, refreshPending } from "../../src/stores/events"
import { useConnections } from "../../src/stores/connections"
import { useCatalog } from "../../src/stores/catalog"
import { useSpeech } from "../../src/lib/speech"

// --- Builtin slash commands ---
const BUILTIN_COMMANDS: SlashCommand[] = [
  {
    trigger: "new",
    title: "New Session",
    description: "Start a new session",
    icon: "add-circle-outline",
    type: "builtin",
  },
  {
    trigger: "model",
    title: "Switch Model",
    description: "Choose a different model",
    icon: "hardware-chip-outline",
    type: "builtin",
  },
  {
    trigger: "agent",
    title: "Switch Agent",
    description: "Cycle to next agent",
    icon: "person-outline",
    type: "builtin",
  },
]

function getShortDir(dir?: string): string | null {
  if (!dir) return null
  const parts = dir.split("/").filter(Boolean)
  return parts[parts.length - 1] || null
}

export default function SessionScreen() {
  const { id, directory, prompt } = useLocalSearchParams<{ id: string; directory?: string; prompt?: string }>()
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const flatListRef = useRef<FlatList>(null)
  const modelSheetRef = useRef<BottomSheet>(null)
  const variantSheetRef = useRef<BottomSheet>(null)
  const [input, setInput] = useState("")
  // Keyboard height via JS Keyboard events — the guaranteed path on Android.
  // react-native-keyboard-controller's native measurement is flaky on some
  // Samsung/Android-11 IMEs; Keyboard events always fire.
  const [kbHeight, setKbHeight] = useState(0)
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKbHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener("keyboardDidHide", () => setKbHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  // Template chips push a `prompt` param — prefill the composer once.
  const promptFilled = useRef(false)
  useEffect(() => {
    if (prompt && !promptFilled.current) {
      promptFilled.current = true
      setInput(String(prompt))
    }
  }, [prompt])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [showInfo, setShowInfo] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const {
    currentSession,
    messages,
    parts,
    isLoading,
    loadingMore,
    hasMore,
    selectSession,
    sendMessage,
    abortSession,
    loadOlderMessages,
    refreshMessages,
    revertToMessage,
    unrevertSession,
  } = useSessions()

  // Derive sending state for this specific session
  const isSending = useSessions((s) => !!(currentSession && s.sending[currentSession.id]))
  const stuckAt = useSessions((s) => s.stuckAt)
  const clearStuck = useSessions((s) => s.clearStuck)
  // NOTE: sessionID must be declared BEFORE the selectors below — the
  // selectors close over it, and a later declaration is hoisted as undefined
  // (making retrying/statusText dead code).
  const sessionID = currentSession?.id
  const busyStatus = useEvents((s) => (sessionID ? s.sessionStatus[sessionID] : undefined))
  const statusText = useEvents((s) => (sessionID ? s.statusText[sessionID] : undefined))

  // In-flow thinking indicator (P1): the pixel loader renders as the last
  // element of the message flow while the agent works; retry stays in the
  // slim status bar (StatusIndicator below).
  const retrying = busyStatus?.type === "retry"
  const busy = isSending || (busyStatus != null && busyStatus.type !== "idle")
  const statusLabel = retrying
    ? t("chat.statusIndicator.retrying", { attempt: busyStatus.attempt })
    : statusText || t("chat.statusIndicator.working")
  const showInlineLoader = busy && !retrying

  const { client, clientForDirectory } = useConnections()

  // Use directory-aware client for sessions that belong to a project other than the active one
  const sessionClient = useMemo(
    () => (currentSession?.directory ? (clientForDirectory(currentSession.directory) ?? client) : client),
    [currentSession?.directory, clientForDirectory, client],
  )

  // Catalog
  const catalog = useCatalog()
  const agents = Array.isArray(catalog.agents) ? catalog.agents : []
  const serverCommands = Array.isArray(catalog.commands) ? catalog.commands : []
  const providers = Array.isArray(catalog.providers) ? catalog.providers : []
  const agent = catalog.agent || ""
  const model = catalog.model
  const setModel = catalog.setModel
  const variant = catalog.variant

  // Terminal sync (the "I sent from my phone but it doesn't show here" fix):
  // The opencode serve process only emits SSE events for its own API calls;
  // messages written by the CLI (terminal) produce no events. Poll the
  // current session every 15s while this screen is open so terminal activity
  // is always visible with at most 15s latency. Cost: one small GET.
  useEffect(() => {
    if (!sessionID) return
    const sync = setInterval(() => {
      if (useSessions.getState().sending[sessionID]) return
      void refreshMessages().catch(() => {})
    }, 15_000)
    return () => clearInterval(sync)
  }, [sessionID])
  const setVariant = catalog.setVariant
  const cycleAgent = catalog.cycleAgent

  // Permission & question state
  const permissions = useEvents((s) => (sessionID ? s.permissions[sessionID] : undefined)) || []
  const questions = useEvents((s) => (sessionID ? s.questions[sessionID] : undefined)) || []

  const shortDir = getShortDir(currentSession?.directory)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // SSE reconnect banner
  const reconnectAttempts = useEvents((s) => s.reconnectAttempts)
  const [showConnectedFlash, setShowConnectedFlash] = useState(false)
  const prevReconnecting = useRef(false)

  // Voice input — transcript appends to the text input on completion
  const speech = useSpeech(
    useCallback((text: string) => {
      setInput((prev) => (prev ? prev + " " + text : text))
    }, []),
  )

  // Surface speech recognition failures (e.g. mic permission denied). Keyed
  // on the error value itself so it only fires once per distinct error, not
  // on every re-render while it remains set.
  useEffect(() => {
    if (!speech.error) return
    Alert.alert(t("session.alerts.speechErrorTitle"), t("session.alerts.speechErrorMessage"))
  }, [speech.error, t])

  // Slash command state

  const allCommands = useMemo<SlashCommand[]>(() => {
    const custom: SlashCommand[] = serverCommands.map((cmd) => ({
      trigger: cmd.name,
      title: cmd.name,
      description: cmd.description,
      icon: "code-slash-outline",
      type: "custom",
    }))
    return [...custom, ...BUILTIN_COMMANDS]
  }, [serverCommands])

  // While a revert is pending, the reverted message and everything after it
  // still exist server-side (cleanup only runs on the next prompt/unrevert)
  // — hide them client-side so editing feels immediate. Message IDs are
  // lexicographically sortable, same comparison the TUI uses. Optimistic
  // "temp-" IDs (assigned client-side before the server responds, see
  // sendMessage) aren't part of that sort order — always keep them so a
  // message sent concurrently with a revert isn't hidden.
  const revertMessageID = currentSession?.revert?.messageID

  // Inverted FlatList: data is reversed (newest first) so newest renders at bottom
  const messageData = useMemo(
    () => {
      const list: Array<{ message: Message; parts: Part[]; grouped: boolean }> = (messages || [])
        .filter((msg) => !revertMessageID || msg.id.startsWith("temp-") || msg.id < revertMessageID)
        .map((msg) => ({ message: msg, parts: (parts && parts[msg.id]) || [], grouped: false }))
        .reverse()
      // P3: mark the first of a run of same-role messages so followers can
      // drop the avatar/role label (ChatGPT/Claude grouping).
      for (let i = 1; i < list.length; i++) {
        list[i].grouped = list[i - 1].message.role === list[i].message.role
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        return list.filter((item) =>
          item.parts.some((p) => p.type === "text" && p.text && p.text.toLowerCase().includes(q)),
        )
      }
      return list
    },
    [messages, parts, revertMessageID, searchQuery],
  )

  // Tracks the latest composer text without pulling `input` into
  // handleMessageLongPress's deps — kept as a plain ref assignment (not
  // state) so the callback below stays referentially stable across
  // keystrokes for MessageBubble's custom memo comparator.
  const inputRef = useRef(input)
  inputRef.current = input

  const applyRevertResult = useCallback((result: Awaited<ReturnType<typeof revertToMessage>>) => {
    if (!result.ok) {
      if (result.reason === "unsupported") {
        Alert.alert(t("session.alerts.notSupportedTitle"), t("session.alerts.notSupportedMessage"))
      } else if (result.reason === "auth") {
        Alert.alert(t("session.alerts.revertAuthFailedTitle"), t("session.alerts.revertAuthFailedMessage"))
      } else {
        Alert.alert(t("session.alerts.editFailedTitle"), t("session.alerts.editFailedMessage"))
      }
      return
    }
    setInput(result.text)
    // Restore attachments in the same shape the composer's own picker
    // functions (pickFromLibrary/pickFromCamera/pasteFromClipboard) use.
    setAttachments(
      result.files
        .filter((f): f is typeof f & { url: string; mime: string } => !!f.url && !!f.mime)
        .map((f) => ({ uri: f.url, mime: f.mime, filename: f.filename })),
    )
  }, [t])

  // Stable across renders (reads fresh state via getState() rather than
  // closing over props) so MessageBubble's custom memo comparator can bail
  // safely without risking a stale handler.
  const handleMessageLongPress = useCallback((messageID: string) => {
    const copyMessage = () => {
      const text = (useSessions.getState().parts[messageID] || [])
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text)
        .join("\n")
      if (text) void Clipboard.setStringAsync(text)
    }
    Alert.alert(t("session.alerts.messageActionsTitle"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("session.actions.copyMessage"), onPress: copyMessage },
      {
        text: t("session.actions.editMessage"),
        onPress: () => {
          const doRevert = async () => {
            const result = await useSessions.getState().revertToMessage(messageID)
            applyRevertResult(result)
          }
          // Editing overwrites the composer — don't silently clobber an
          // in-progress unsent draft.
          if (inputRef.current.trim()) {
            Alert.alert(
              t("session.alerts.replaceDraftTitle"),
              t("session.alerts.replaceDraftMessage"),
              [
                { text: t("common.cancel"), style: "cancel" },
                { text: t("session.actions.replace"), style: "destructive", onPress: doRevert },
              ],
              { cancelable: false },
            )
            return
          }
          doRevert()
        },
      },
    ])
  }, [applyRevertResult, t])

  const scrollToBottom = useCallback((animated = true) => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated })
  }, [])

  // Re-select on every focus, not just mount. currentSession/messages/
  // permissions are a single global store, and the native stack keeps screens
  // underneath a pushed one mounted. Without re-selecting on focus, navigating
  // to another session and back would leave this screen bound to the *other*
  // session's data (and its permission/question prompts) — so a user could
  // approve the wrong session's tool call. useFocusEffect re-binds this screen
  // to its own session whenever it becomes visible again.
  useFocusEffect(
    useCallback(() => {
      if (!id) return
      // Directory param may be absent (notification taps / deep links) —
      // fall back to the already-loaded session's directory so the right
      // per-directory client is used.
      const effectiveDir = directory || useSessions.getState().currentSession?.directory
      selectSession(id, effectiveDir).then(() => {
        // Re-fetch pending permissions/questions from the server to recover from
        // missed SSE events or failed optimistic removals
        const connState = useConnections.getState()
        const c = effectiveDir ? (connState.clientForDirectory(effectiveDir) ?? connState.client) : connState.client
        if (c) refreshPending(c, id)
      })
    }, [id, directory]),
  )

  // Sync model chip from latest assistant message
  useEffect(() => {
    if (!messages || messages.length === 0) return
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg.role === "assistant" && msg.providerID && msg.modelID) {
        setModel({ providerID: msg.providerID, modelID: msg.modelID })
        return
      }
      if (msg.role === "user" && msg.model) {
        setModel(msg.model)
        return
      }
    }
  }, [currentSession?.id, messages?.length])

  // Slash command handler
  const handleSlashSelect = useCallback(
    (cmd: SlashCommand) => {
      if (cmd.type === "builtin") {
        switch (cmd.trigger) {
          case "new":
            router.back()
            return
          case "model":
            setInput("")
            modelSheetRef.current?.expand()
            return
          case "agent":
            setInput("")
            cycleAgent()
            return
        }
      }
      setInput(`/${cmd.trigger} `)
    },
    [router, cycleAgent],
  )

  // --- Image picking ---

  // Convert any image (including HEIC/HEIF from iOS) to guaranteed JPEG bytes
  const MAX_DIMENSION = 1568 // Anthropic recommended max
  async function toJpeg(uri: string, width: number, height: number): Promise<Attachment> {
    const actions: ImageManipulator.Action[] = []
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(width, height)
      actions.push({ resize: { width: Math.round(width * scale), height: Math.round(height * scale) } })
    }
    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      format: ImageManipulator.SaveFormat.JPEG,
      compress: 0.8,
      base64: true,
    })
    return {
      uri: result.uri,
      mime: "image/jpeg",
      filename: "image.jpg",
      width: result.width,
      height: result.height,
      base64: result.base64 || undefined,
    }
  }

  const pickFromLibrary = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 1, // full quality - we compress in manipulator
      })
      if (result.canceled) return
      const settled = await Promise.allSettled(result.assets.map((a) => toJpeg(a.uri, a.width, a.height)))
      const items = settled.filter((r) => r.status === "fulfilled").map((r) => r.value)
      if (items.length) setAttachments((prev) => [...prev, ...items])
      if (settled.some((r) => r.status === "rejected")) {
        console.error(
          "Failed to process image(s):",
          settled.filter((r) => r.status === "rejected").map((r) => r.reason),
        )
        Alert.alert(t("session.alerts.imageFailedTitle"), t("session.alerts.imageFailedMessage"))
      }
    } catch (err) {
      console.error("Image picker failed:", err)
      Alert.alert(t("session.alerts.imageFailedTitle"), t("session.alerts.imageFailedMessage"))
    }
  }, [t])

  const pickFromCamera = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert(t("session.alerts.cameraPermissionTitle"), t("session.alerts.cameraPermissionMessage"))
        return
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 1 })
      if (result.canceled) return
      const a = result.assets[0]
      try {
        const item = await toJpeg(a.uri, a.width, a.height)
        setAttachments((prev) => [...prev, item])
      } catch (err) {
        console.error("Failed to process photo:", err)
        Alert.alert(t("session.alerts.imageFailedTitle"), t("session.alerts.imageFailedMessage"))
      }
    } catch (err) {
      console.error("Camera failed:", err)
      Alert.alert(t("session.alerts.cameraPermissionTitle"), t("session.alerts.cameraPermissionMessage"))
    }
  }, [t])

  const pasteFromClipboard = useCallback(async () => {
    try {
    // Try image first
    const hasImage = await Clipboard.hasImageAsync()
    if (hasImage) {
      const img = await Clipboard.getImageAsync({ format: "png" })
      if (img?.data) {
        const uri = img.data.startsWith("data:") ? img.data : `data:image/png;base64,${img.data}`
        const item = await toJpeg(uri, img.size.width, img.size.height)
        setAttachments((prev) => [...prev, item])
        return
      }
    }
    // Fall back to text
    const hasText = await Clipboard.hasStringAsync()
    if (hasText) {
      const text = await Clipboard.getStringAsync()
      if (text) {
        setInput((prev) => prev + text)
        return
      }
    }
    Alert.alert(t("session.alerts.emptyClipboardTitle"), t("session.alerts.emptyClipboardMessage"))
    } catch (err) {
      console.error("Clipboard failed:", err)
      Alert.alert(t("session.alerts.emptyClipboardTitle"), t("session.alerts.emptyClipboardMessage"))
    }
  }, [t])

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // --- Send ---
  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Send-gap guard: while selectSession(id) is still in flight, the global
    // currentSession is the PREVIOUS session — a send now would target the
    // wrong conversation (the "my message didn't land in the terminal" bug
    // family). Re-select until this screen's session is current.
    const cur = useSessions.getState().currentSession
    if (!cur || cur.id !== id) {
      try {
        await selectSession(id, directory || cur?.directory)
      } catch {
        Alert.alert(t("session.alerts.selectFailedTitle"), t("session.alerts.selectFailedMessage"))
        return
      }
    }

    const text = input.trim()
    const files = [...attachments]
    setInput("")
    setAttachments([])

    // Server slash commands (no attachments for commands)
    if (text.startsWith("/") && files.length === 0) {
      const [cmdName, ...args] = text.split(" ")
      const name = cmdName.slice(1)
      const match = serverCommands.find((c) => c.name === name)
      if (match && sessionClient && currentSession) {
        sessionClient.session
          .command(currentSession.id, {
            command: name,
            arguments: args.join(" "),
            agent,
            model: model ? `${model.providerID}/${model.modelID}` : undefined,
          })
          .catch((err) => console.error("Command failed:", err))
        return
      }
    }

    // Messages are queued server-side when the session is busy.
    // No need to abort - just send and it will be processed after current response.
    try {
      await sendMessage(text, model || undefined, agent || undefined, files, variant || undefined)
    } catch (err) {
      console.error("Send failed:", err)
      // Restore the user's text and attachments so their input isn't lost.
      setInput((prev) => (prev ? prev : text))
      setAttachments((prev) => (prev.length ? prev : files))
      Alert.alert(t("session.alerts.sendFailedTitle"), t("session.alerts.sendFailedMessage"))
    }
  }

  // In inverted mode, offset 0 = bottom. Show scroll button when scrolled away from bottom.
  const nearBottomRef = useRef(true)
  const handleScroll = useCallback((event: any) => {
    const { contentOffset } = event.nativeEvent
    const near = contentOffset.y < 200
    nearBottomRef.current = near
    setShowScrollButton(!near)
  }, [])

  // Chat auto-follow (the "I see the last token, not the first" fix): while
  // the agent is working, keep the view pinned at the bottom so the FIRST
  // token of every new section is visible as it starts. Only when the user
  // has scrolled up (nearBottomRef false) do we hold position.
  const onListContentSizeChange = useCallback(() => {
    if (busy && nearBottomRef.current) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false })
    }
  }, [busy])

  // Debounce: onEndReached can fire multiple times during a single scroll gesture
  const loadingTriggered = useRef(false)
  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingMore && !loadingTriggered.current) {
      loadingTriggered.current = true
      loadOlderMessages()
    }
  }, [hasMore, loadingMore, loadOlderMessages])

  // Reset trigger when loading finishes
  useEffect(() => {
    if (!loadingMore) loadingTriggered.current = false
  }, [loadingMore])

  // Detect reconnecting → stable transition for the "Connected ✓" flash.
  // reconnectAttempts and lastDisconnectAt reset in the same set() call, so we
  // can't use lastDisconnectAt alone; a useRef tracks the prior reconnecting state.
  useEffect(() => {
    const isReconnecting = reconnectAttempts > 0
    if (prevReconnecting.current && !isReconnecting) {
      setShowConnectedFlash(true)
      const t = setTimeout(() => setShowConnectedFlash(false), 2000)
      return () => clearTimeout(t)
    }
    prevReconnecting.current = isReconnecting
  }, [reconnectAttempts])

  const handlePermissionReply = async (requestID: string, reply: "once" | "always" | "reject") => {
    if (!sessionClient || !sessionID) return
    // Snapshot for rollback
    const snapshot = useEvents.getState().permissions[sessionID] || []
    // Optimistically remove from UI
    useEvents.setState((state) => ({
      permissions: {
        ...state.permissions,
        [sessionID]: snapshot.filter((p) => p.id !== requestID),
      },
    }))
    try {
      await sessionClient.permission.reply(requestID, reply)
    } catch (err) {
      console.error("Permission reply failed:", err)
      // Restore the prompt so the user can retry
      useEvents.setState((state) => ({
        permissions: { ...state.permissions, [sessionID]: snapshot },
      }))
      Alert.alert(t("session.alerts.replyFailedTitle"), t("session.alerts.replyFailedMessage"))
    }
  }

  const handleQuestionReply = async (requestID: string, answers: string[][]) => {
    if (!sessionClient || !sessionID) return
    const snapshot = useEvents.getState().questions[sessionID] || []
    useEvents.setState((state) => ({
      questions: {
        ...state.questions,
        [sessionID]: snapshot.filter((q) => q.id !== requestID),
      },
    }))
    try {
      await sessionClient.question.reply(requestID, answers)
    } catch (err) {
      console.error("Question reply failed:", err)
      useEvents.setState((state) => ({
        questions: { ...state.questions, [sessionID]: snapshot },
      }))
      Alert.alert(t("session.alerts.replyFailedTitle"), t("session.alerts.replyFailedMessage"))
    }
  }

  const handleQuestionReject = async (requestID: string) => {
    if (!sessionClient || !sessionID) return
    const snapshot = useEvents.getState().questions[sessionID] || []
    useEvents.setState((state) => ({
      questions: {
        ...state.questions,
        [sessionID]: snapshot.filter((q) => q.id !== requestID),
      },
    }))
    try {
      await sessionClient.question.reject(requestID)
    } catch (err) {
      console.error("Question reject failed:", err)
      useEvents.setState((state) => ({
        questions: { ...state.questions, [sessionID]: snapshot },
      }))
      Alert.alert(t("session.alerts.rejectFailedTitle"), t("session.alerts.rejectFailedMessage"))
    }
  }

  // Model-change counter — fires the composer's rainbow sweep.
  const [sweepSignal, setSweepSignal] = useState(0)
  const handleModelSelect = useCallback(
    (providerID: string, modelID: string) => {
      setModel({ providerID, modelID })
      setSweepSignal((n) => n + 1)
      void Haptics.selectionAsync()
    },
    [setModel],
  )

  // Current agent display
  const modelLabel = model?.modelID ? model.modelID.split("/").pop() || model.modelID : "default"

  // Variants for current model (for reasoning effort picker)
  const currentModelVariants = useMemo(() => {
    if (!model) return undefined
    const provider = providers.find((p) => p.id === model.providerID)
    const found = provider?.models.find((m) => m.id === model.modelID)
    return found?.variants
  }, [model, providers])

  // Flat model list for the inline PromptBar model menu (connected providers only)
  const flatModels = useMemo(
    () =>
      providers.flatMap((p) =>
        p.models.map((m) => ({ providerID: p.id, modelID: m.id })),
      ),
    [providers],
  )

  return (
    <>
      <Stack.Screen
        options={{
          title: currentSession?.title || t("session.titleFallback"),
          headerRight: () => (
            <View style={s.headerRight}>
              {shortDir && (
                <View style={[s.dirBadge, { backgroundColor: theme.cream2 }]}>
                  <Ionicons name="folder-outline" size={14} color={isDark ? "#888888" : "#666666"} />
                  <Text style={[s.dirText, { color: theme.inkSoft }]}>{shortDir}</Text>
                </View>
              )}
              <TouchableOpacity onPress={() => setSearchOpen((v) => !v)} hitSlop={8}>
                <Ionicons name="search-outline" size={20} color={theme.inkSoft} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowInfo((v) => !v)} hitSlop={8}>
                <Ionicons
                  name={showInfo ? "stats-chart" : "stats-chart-outline"}
                  size={20}
                  color={showInfo ? "#3b82f6" : isDark ? "#888888" : "#666666"}
                />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <View
        style={[
          s.container,
          { backgroundColor: theme.cream, paddingBottom: kbHeight },
        ]}
        // Keyboard avoidance: JS Keyboard events (above) measure the exact
        // keyboard height and pad this container, so the composer ALWAYS
        // rises above the keyboard on any Android IME. This is the
        // deterministic path — no native measurement to fail on.
      >
        {/* Session info pulldown */}
        <SessionInfo
          session={currentSession}
          messages={messages || []}
          providers={providers}
          visible={showInfo}
          isDark={isDark}
          hasMore={hasMore}
          loadingAll={loadingMore}
          onLoadAll={() => {
            if (hasMore && !loadingMore) loadOlderMessages()
          }}
          onScrollToTop={() => {
            flatListRef.current?.scrollToEnd({ animated: true })
          }}
          onClose={() => setShowInfo(false)}
        />

        {/* Message search */}
        {searchOpen && (
          <View style={[s.searchBar, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <Ionicons name="search" size={16} color={theme.inkFaint} />
            <TextInput
              style={[s.searchInput, { color: theme.ink }]}
              placeholder={t("session.searchPlaceholder")}
              placeholderTextColor={theme.inkFaint}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={theme.inkFaint} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* SSE reconnect/connected banner */}
        {reconnectAttempts > 0 && (
          <View style={[s.banner, s.bannerReconnecting]}>
            <Text style={s.bannerText}>{t("session.banners.reconnecting", { attempt: reconnectAttempts })}</Text>
          </View>
        )}
        {showConnectedFlash && reconnectAttempts === 0 && (
          <View style={[s.banner, s.bannerConnected]}>
            <Text style={s.bannerText}>{t("session.banners.connected")}</Text>
          </View>
        )}

        {/* No-response watchdog: prompt accepted but the agent never ran
            (e.g. the model's provider has no credentials on the server). */}
        {currentSession && stuckAt[currentSession.id] ? (
          <View style={[s.banner, s.bannerStuck]}>
            <Text style={s.bannerText}>{t("session.banners.noResponse")}</Text>
            <TouchableOpacity
              onPress={() => {
                clearStuck(currentSession.id)
                // The watchdog fired because no SSE activity arrived — clear
                // the optimistic sending flag too, or the spinner keeps
                // spinning forever even after Refresh pulls the truth.
                useSessions.setState((s) => ({
                  sending: { ...s.sending, [currentSession.id]: false },
                }))
                void refreshMessages()
              }}
              hitSlop={8}
            >
              <Text style={s.bannerAction}>{t("session.banners.noResponseAction")}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Pending revert (from "Edit message") — offer a way back before it's
            cleaned up by the next prompt. */}
        {revertMessageID && (
          <View style={[s.banner, s.bannerRevert]}>
            <Text style={s.bannerText}>{t("session.banners.reverted")}</Text>
            <TouchableOpacity
              onPress={() => {
                unrevertSession()
                // The composer was prefilled with the reverted message's text/
                // attachments (see applyRevertResult) — clear it so Undo doesn't
                // leave a stale draft that could be sent as a duplicate.
                setInput("")
                setAttachments([])
              }}
              hitSlop={8}
            >
              <Text style={s.bannerAction}>{t("session.banners.undo")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoading ? (
          <View style={s.loading}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        ) : (
          <View style={s.listWrap}>
            <FlatList
              ref={flatListRef}
              data={messageData}
              inverted
              keyExtractor={(item) => item.message.id}
              renderItem={({ item }) => (
                <FadeUp>
                  <MessageBubble
                    message={item.message}
                    parts={item.parts}
                    isDark={isDark}
                    grouped={item.grouped}
                    onLongPress={handleMessageLongPress}
                  />
                </FadeUp>
              )}
              contentContainerStyle={s.messageList}
              onScroll={handleScroll}
              onContentSizeChange={onListContentSizeChange}
              scrollEventThrottle={100}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true)
                    void refreshMessages().finally(() => setRefreshing(false))
                  }}
                  tintColor={theme.accent}
                  colors={[theme.accent]}
                />
              }
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              // Prevent jump when older messages are prepended
              maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
              ListFooterComponent={
                loadingMore ? (
                  <View style={s.loadingMore}>
                    <ActivityIndicator size="small" color={isDark ? "#888888" : "#666666"} />
                    <Text style={[s.loadingMoreText, { color: theme.inkFaint }]}>{t("session.loadingOlder")}</Text>
                  </View>
                ) : null
              }
              ListHeaderComponent={
                showInlineLoader ? (
                  <View style={{ paddingVertical: 10, paddingLeft: 38 }}>
                    <StreamingLoader label={statusLabel} />
                  </View>
                ) : null
              }
            />
            {/* Empty state rendered OUTSIDE the inverted list to avoid the
                inverted transform mirroring its text/icon (see #ui-mirror). */}
            {messageData.length === 0 && !searchQuery.trim() && (
              <View style={s.emptyOverlay} pointerEvents="none">
                <View style={[s.emptyGlyph, { backgroundColor: theme.accentSoft }]}>
                  <Text style={{ fontFamily: theme.serif, fontWeight: "700", fontSize: 26, color: theme.accentDeep }}>C</Text>
                </View>
                <Text style={[s.emptyText, { color: theme.inkSoft }]}>{t("session.empty.title")}</Text>
                <Text style={[s.emptyHint, { color: theme.inkFaint }]}>{t("session.empty.hint")}</Text>
              </View>
            )}
            {showScrollButton && (
              <TouchableOpacity style={[s.scrollBtn, { backgroundColor: theme.card }]} onPress={() => scrollToBottom(true)}>
                <Ionicons name="chevron-down" size={24} color={theme.ink} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Status */}
        {/* Retry states stay in the slim bar; normal busy is in-flow (P1) */}
        {currentSession && retrying && <StatusIndicator sessionID={currentSession.id} isDark={isDark} />}

        {/* Permissions */}
        {permissions.map((perm) => (
          <PermissionPrompt
            key={perm.id}
            permission={perm}
            isDark={isDark}
            onReply={(reply) => handlePermissionReply(perm.id, reply)}
          />
        ))}

        {/* Questions */}
        {questions.map((q) => (
          <QuestionPrompt
            key={q.id}
            request={q}
            isDark={isDark}
            onReply={(answers) => handleQuestionReply(q.id, answers)}
            onReject={() => handleQuestionReject(q.id)}
          />
        ))}

        {/* Slash popover — commands now live in the PromptBar menu */}
        {/* Agent/model toolbar — replaced by PromptBar */}
        {/* Attachment preview */}
        <ImageAttachments attachments={attachments} isDark={isDark} onRemove={removeAttachment} />

        {/* Composer — Claude-style prompt bar with @ / / menus and inline model picker */}
        <PromptBar
          value={input}
          onChangeText={setInput}
          onSend={handleSend}
          canSend={attachments.length > 0}
          isSending={isSending}
          onAbort={abortSession}
          model={model}
          modelLabel={modelLabel}
          models={flatModels}
          onSelectModel={handleModelSelect}
          sweepSignal={sweepSignal}
          agent={agent || "build"}
          onCycleAgent={() => cycleAgent()}
          commands={allCommands}
          onCommandSelect={handleSlashSelect}
          variantLabel={variant ? variant.charAt(0).toUpperCase() + variant.slice(1) : null}
          onOpenVariant={() => variantSheetRef.current?.expand()}
          speech={speech}
          onPickImage={() => void pickFromLibrary()}
          onTakePhoto={() => void pickFromCamera()}
          onPasteClipboard={() => void pasteFromClipboard()}
        />
      </View>

      {/* Model picker bottom sheet */}
      <ModelPicker
        sheetRef={modelSheetRef}
        providers={providers}
        selected={model}
        isDark={isDark}
        onSelect={handleModelSelect}
      />

      {/* Reasoning effort (variant) picker bottom sheet */}
      <VariantPicker
        sheetRef={variantSheetRef}
        variants={currentModelVariants}
        selected={variant}
        isDark={isDark}
        onSelect={setVariant}
      />
    </>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  listWrap: { flex: 1, position: "relative" },

  // Messages
  messageList: { padding: 16, paddingBottom: 8 },

  // Scroll button
  scrollBtn: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  scrollBtnDark: { backgroundColor: "#2a2a2a" },

  // Loading more (appears at top in inverted list = ListFooterComponent)
  loadingMore: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  loadingMoreText: { fontSize: 13 },

  // Empty state overlay — sits on top of the (empty) inverted list, untransformed,
  // so its text/icon render upright and un-mirrored on Android.
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },

  // Empty
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 64 },
  emptyGlyph: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyText: { fontSize: 16, marginTop: 12 },
  emptyHint: { fontSize: 13, marginTop: 4 },
  metaDark: {},
  textWhite: { color: "#ffffff" },

  // Toolbar — pills above the composer, no border

  // Variant (reasoning effort) chip

  // Input — floating composer card
  inputContainer: {
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  input: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14.5,
    maxHeight: 120,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },

  // Header
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  dirBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dirText: { fontSize: 12, fontWeight: "500" },

  // SSE reconnect/connected banner
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: "center",
  },
  bannerReconnecting: { backgroundColor: "#92400e" },
  bannerConnected: { backgroundColor: "#065f46" },
  bannerStuck: { backgroundColor: "#7f1d1d" },
  bannerText: { color: "#ffffff", fontSize: 13, fontWeight: "500" },

  // Pending revert (edit message) banner
  bannerRevert: {
    backgroundColor: "#1e3a8a",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bannerAction: { color: "#93c5fd", fontSize: 13, fontWeight: "700" },
})
