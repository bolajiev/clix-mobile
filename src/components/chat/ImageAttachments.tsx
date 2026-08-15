import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "../../theme/tokens"

export interface Attachment {
  uri: string
  mime: string
  filename?: string
  width?: number
  height?: number
  base64?: string
}

interface Props {
  attachments: Attachment[]
  isDark: boolean
  onRemove: (index: number) => void
}

export function ImageAttachments({ attachments, isDark, onRemove }: Props) {
  const theme = useTheme()
  if (attachments.length === 0) return null

  return (
    <View style={[s.container, { borderTopColor: theme.line }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {attachments.map((att, idx) => (
          <View key={`${att.uri}-${idx}`} style={s.thumb}>
            <Image source={{ uri: att.uri }} style={[s.image, { backgroundColor: theme.cream2 }]} resizeMode="cover" />
            <TouchableOpacity
              style={[s.remove, { backgroundColor: theme.ink, borderColor: theme.cream }]}
              onPress={() => onRemove(idx)}
              accessibilityRole="button"
              accessibilityLabel="Remove attachment"
            >
              <Ionicons name="close" size={12} color={theme.cream} />
            </TouchableOpacity>
            {att.filename && (
              <Text style={[s.label, { color: theme.inkFaint }]} numberOfLines={1}>
                {att.filename}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  scroll: { gap: 8 },
  thumb: { position: "relative" },
  image: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  label: {
    fontSize: 11,
    marginTop: 2,
    maxWidth: 72,
    textAlign: "center",
  },
})
