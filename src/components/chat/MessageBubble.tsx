import { memo, useEffect, useRef } from "react"
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated } from "react-native"
import * as Clipboard from "expo-clipboard"
import { Ionicons } from "@expo/vector-icons"
import { Markdown } from "../markdown"
import { ToolCallCard } from "./ToolCallCard"
import { ReasoningBlock } from "./ReasoningBlock"
import type { Message, Part } from "../../lib/sdk"
import { useTheme } from "../../theme/tokens"

const SCREEN_WIDTH = Dimensions.get("window").width

function isImageMime(mime?: string): boolean {
  return !!mime && mime.startsWith("image/")
}

// Blinking cursor shown at the end of an assistant text while its message is
// still streaming (P2). Unmounts when the message completes.
function StreamingCursor() {
  const opacity = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.15, duration: 420, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])
  return <Animated.Text style={{ opacity, color: "#FAB283", fontSize: 14 }}>▍</Animated.Text>
}

interface Props {
  message: Message
  parts: Part[]
  isDark: boolean
  // True when the previous message has the same role — hide the avatar and
  // role label for a grouped run (P3).
  grouped?: boolean
  // Only wired up for user messages — long-press opens the "Edit message" /
  // revert action sheet. Identified by messageID (not a closure over parts)
  // so it stays correct even if the memo below bails on a stale render.
  onLongPress?: (messageID: string) => void
}

// TODO: Replace with streamdown-rn once React 19 types PR lands - it has
// built-in block-level memoization that eliminates re-renders for stable blocks
export const MessageBubble = memo(
  function MessageBubble({ message, parts, isDark, grouped, onLongPress }: Props) {
    const isUser = message.role === "user"
    const theme = useTheme()
    const streaming = !isUser && !message.time?.completed && !message.error

    const textParts = parts.filter((p) => p.type === "text")
    const reasoningParts = parts.filter((p) => p.type === "reasoning")
    const toolParts = parts.filter((p) => p.type === "tool")
    const fileParts = parts.filter((p) => p.type === "file" && isImageMime(p.mime))
    const text = textParts.map((p) => p.text).join("\n") || ""
    const reasoning = reasoningParts.map((p) => p.text).join("\n") || ""

    const copyText = () => {
      const all = parts
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text)
        .join("\n")
      if (all) void Clipboard.setStringAsync(all)
    }

    return (
      <TouchableOpacity
        activeOpacity={isUser && onLongPress ? 0.7 : 1}
        onLongPress={isUser && onLongPress ? () => onLongPress(message.id) : undefined}
        disabled={!isUser || !onLongPress}
        style={[
          s.bubble,
          isUser ? s.user : s.assistant,
          grouped && (isUser ? s.groupedUser : s.groupedAssistant),
        ]}
        testID={`chat-bubble-${message.role}`}
      >
        <View style={s.bubbleInner}>
          {/* Role indicator */}
          {!grouped && (
            <View style={s.header}>
              <Text style={[s.role, { color: theme.inkFaint }]}>
                {isUser ? "You" : "Assistant"}
              </Text>
              {!isUser && (message.model?.modelID || message.modelID) && (
                <Text style={[s.modelTag, { backgroundColor: theme.cream2, color: theme.inkFaint }]}>
                  {message.model?.modelID || message.modelID}
                </Text>
              )}
              {!isUser && text.length > 0 && (
                <TouchableOpacity onPress={copyText} hitSlop={8} accessibilityRole="button" accessibilityLabel="Copy message">
                  <Ionicons name="copy-outline" size={13} color={theme.inkFaint} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Image attachments */}
          {fileParts.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.imageRow}
              style={s.imageScroll}
            >
              {fileParts.map((fp) => (
                <View key={fp.id} style={s.imageWrap}>
                  <Image source={{ uri: fp.url }} style={s.attachedImage} resizeMode="cover" />
                  {fp.filename && (
                    <Text style={[s.imageLabel, { color: theme.inkFaint }]} numberOfLines={1}>
                      {fp.filename}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          )}

          {/* Reasoning (collapsible) */}
          {reasoning.length > 0 && <ReasoningBlock text={reasoning} isDark={isDark} />}

          {/* Message text */}
          {text.length > 0 &&
            (isUser ? (
              <Text style={[s.messageText, { color: theme.ink }]} selectable>
                {text}
              </Text>
            ) : (
              <View style={s.markdownWrap}>
                <Markdown>{text}</Markdown>
                {streaming && <StreamingCursor />}
              </View>
            ))}

          {/* Tool calls */}
          {toolParts.map((tool) => (
            <ToolCallCard key={tool.id} tool={tool} isDark={isDark} />
          ))}

          {/* Tokens/cost for assistant messages — a small meta pill */}
          {!isUser && message.tokens && (
            <View style={[s.tokensPill, { backgroundColor: theme.cream2 }]}>
              <Text style={[s.tokens, { color: theme.inkFaint }]}>
                ⚡ {(message.tokens.input + message.tokens.output) / 1000 >= 1 ? `${((message.tokens.input + message.tokens.output) / 1000).toFixed(1)}k` : message.tokens.input + message.tokens.output} tokens
                {message.cost ? ` · $${message.cost.toFixed(4)}` : ""}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  },
  (prev, next) => {
    // Only re-render if message content actually changed
    // This prevents completed messages from re-rendering during streaming.
    // The store replaces changed parts/messages with NEW object references,
    // so a reference-equality sweep over every part catches every real change
    // (including tool parts, which have no `.text`) while still skipping
    // unchanged (completed) messages during other messages' streaming.
    if (prev.message !== next.message) return false
    if (prev.isDark !== next.isDark) return false
    if (prev.grouped !== next.grouped) return false
    if (prev.onLongPress !== next.onLongPress) return false
    if (prev.parts.length !== next.parts.length) return false
    for (let i = 0; i < prev.parts.length; i++) {
      if (prev.parts[i] !== next.parts[i]) return false
    }
    return true
  },
)

const s = StyleSheet.create({
  // Borderless chat: no bubble boxes. User text right-aligned on the paper,
  // assistant text left-aligned with a small avatar. Content breathes.
  bubble: { marginBottom: 14 },
  user: { alignSelf: "flex-end", maxWidth: "84%", marginTop: 4, paddingLeft: 32 },
  assistant: { alignSelf: "flex-start", maxWidth: "100%", marginTop: 6, paddingRight: 16 },
  // P3 grouping: followers of a same-role run are tighter
  groupedAssistant: { marginTop: 1, marginBottom: 2 },
  groupedUser: { marginTop: 1, marginBottom: 2 },
  bubbleInner: { minWidth: 0 },

  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  role: { fontSize: 11, fontWeight: "600" },

  modelTag: {
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },

  messageText: { fontSize: 14.5, lineHeight: 22 },
  markdownWrap: { marginHorizontal: -4 },

  tokens: { fontSize: 11, fontVariant: ["tabular-nums"] },
  tokensPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 8,
  },

  // Images
  imageScroll: { marginBottom: 8 },
  imageRow: { gap: 8 },
  imageWrap: { alignItems: "center" },
  attachedImage: {
    width: Math.min(200, SCREEN_WIDTH * 0.5),
    height: Math.min(200, SCREEN_WIDTH * 0.5),
    borderRadius: 8,
    backgroundColor: "#e5e5e5",
  },
  imageLabel: { fontSize: 11, marginTop: 2, maxWidth: 200 },
})

