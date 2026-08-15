import { useRef, useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { useTheme } from "../../theme/tokens"

interface QuestionOption {
  label: string
  description: string
}

interface Question {
  question: string
  header: string
  options: QuestionOption[]
  multiple?: boolean
  custom?: boolean
}

interface Props {
  request: {
    id: string
    questions: Question[]
  }
  isDark: boolean
  onReply: (answers: string[][]) => void
  onReject: () => void
}

export function QuestionPrompt({ request, isDark, onReply, onReject }: Props) {
  const { t } = useTranslation()
  const theme = useTheme()
  const [answers, setAnswers] = useState<string[][]>(request.questions.map(() => []))
  const [custom, setCustom] = useState("")
  const [showCustom, setShowCustom] = useState(false)
  const [current, setCurrent] = useState(0)

  // A question is answered exactly once. Without this guard, a double-tap on a
  // single-select option schedules two `onReply` timers; the second reply hits
  // an already-resolved request server-side and surfaces a spurious
  // "Reply failed" alert even though the answer went through.
  const replied = useRef(false)
  const reply = (a: string[][]) => {
    if (replied.current) return
    replied.current = true
    onReply(a)
  }
  const reject = () => {
    if (replied.current) return
    replied.current = true
    onReject()
  }

  const q = request.questions[current]
  if (!q) return null

  const last = current === request.questions.length - 1
  const selected = answers[current] || []
  const hasAnswer = selected.length > 0 || (showCustom && custom.trim().length > 0)

  const toggleOption = (label: string) => {
    setAnswers((prev) => {
      const copy = [...prev]
      const picked = copy[current] || []
      if (q.multiple) {
        copy[current] = picked.includes(label) ? picked.filter((a) => a !== label) : [...picked, label]
      } else {
        copy[current] = [label]
        if (request.questions.length === 1) {
          setTimeout(() => reply(copy), 100)
        }
      }
      return copy
    })
  }

  const submitCustom = () => {
    if (!custom.trim()) return
    const copy = [...answers]
    copy[current] = [custom.trim()]
    setAnswers(copy)
    setCustom("")
    setShowCustom(false)
    if (request.questions.length === 1) {
      reply(copy)
    }
  }

  const advance = () => {
    if (!hasAnswer) return
    if (last) reply(answers)
    else setCurrent((c) => Math.min(request.questions.length - 1, c + 1))
  }

  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
      {/* Question */}
      <View style={s.qRow}>
        <Text style={[s.question, { color: theme.ink }]}>{q.question}</Text>
        <TouchableOpacity onPress={reject} hitSlop={10} style={s.xBtn}>
          <Ionicons name="close" size={16} color={theme.inkFaint} />
        </TouchableOpacity>
      </View>

      {/* Options — radio / check rows */}
      <ScrollView style={s.options} keyboardShouldPersistTaps="always">
        {q.options.map((opt) => {
          const on = selected.includes(opt.label)
          return (
            <TouchableOpacity key={opt.label} style={s.option} onPress={() => toggleOption(opt.label)}>
              <View
                style={[
                  s.indicator,
                  q.multiple ? s.check : s.radio,
                  on && { backgroundColor: theme.ink },
                  !on && { shadowColor: "transparent", borderWidth: 1.5, borderColor: theme.inkFaint },
                ]}
              >
                {q.multiple ? (
                  on && <Ionicons name="checkmark" size={11} color={theme.cream} />
                ) : (
                  <View style={[s.radioDot, on && { backgroundColor: theme.cream }]} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.optionLabel, { color: on ? theme.ink : theme.inkSoft }]}>{opt.label}</Text>
                {opt.description ? (
                  <Text style={[s.optionDesc, { color: theme.inkFaint }]}>{opt.description}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )
        })}

        {/* Custom answer */}
        {q.custom !== false &&
          (showCustom ? (
            <View style={[s.customRow, { backgroundColor: theme.cream2, borderColor: theme.line }]}>
              <TextInput
                style={[s.customInput, { color: theme.ink }]}
                placeholder={t("chat.questionPrompt.answerPlaceholder")}
                placeholderTextColor={theme.inkFaint}
                value={custom}
                onChangeText={setCustom}
                onSubmitEditing={submitCustom}
                autoFocus
                multiline
              />
              <TouchableOpacity onPress={submitCustom} style={s.customSubmit}>
                <Ionicons name="arrow-up" size={16} color={theme.accentDeep} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.option} onPress={() => setShowCustom(true)}>
              <View style={[s.indicator, s.radio, { borderWidth: 1.5, borderColor: theme.inkFaint }]} />
              <Text style={[s.optionLabel, { color: theme.accentDeep }]}>
                {t("chat.questionPrompt.customAnswerLabel")}
              </Text>
            </TouchableOpacity>
          ))}
      </ScrollView>

      {/* Footer — pager dots + arrow send */}
      <View style={[s.footer, { borderTopColor: theme.line }]}>
        <TouchableOpacity
          onPress={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          hitSlop={8}
          style={s.footBtn}
        >
          <Ionicons name="chevron-back" size={16} color={current === 0 ? theme.inkFaint : theme.inkSoft} />
        </TouchableOpacity>
        <View style={s.dots}>
          {request.questions.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setCurrent(i)}
              style={[
                s.dot,
                i === current
                  ? { width: 9, height: 9, borderWidth: 2.5, borderColor: theme.ink, backgroundColor: "transparent" }
                  : i < current
                    ? { backgroundColor: theme.inkFaint }
                    : { borderWidth: 1.5, borderColor: theme.inkFaint, backgroundColor: "transparent" },
              ]}
            />
          ))}
        </View>
        <TouchableOpacity
          onPress={() => setCurrent((c) => Math.min(request.questions.length - 1, c + 1))}
          disabled={last}
          hitSlop={8}
          style={s.footBtn}
        >
          <Ionicons name="chevron-forward" size={16} color={last ? theme.inkFaint : theme.inkSoft} />
        </TouchableOpacity>
        {!last && (
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: hasAnswer ? theme.ink : theme.cream2 }]}
            onPress={advance}
            disabled={!hasAnswer}
          >
            <Ionicons name="arrow-up" size={14} color={hasAnswer ? theme.cream : theme.inkFaint} />
          </TouchableOpacity>
        )}
        {last && (
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: hasAnswer ? theme.ink : theme.cream2 }]}
            onPress={advance}
            disabled={!hasAnswer}
          >
            <Ionicons name="arrow-up" size={14} color={hasAnswer ? theme.cream : theme.inkFaint} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    paddingBottom: 10,
    shadowColor: "#3D3929",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  qRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  question: { flex: 1, fontSize: 13.5, fontWeight: "500", lineHeight: 19 },
  xBtn: { padding: 2 },
  options: { maxHeight: 240, gap: 0 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  indicator: { width: 16, height: 16, alignItems: "center", justifyContent: "center" },
  radio: { borderRadius: 8 },
  check: { borderRadius: 5 },
  radioDot: { width: 5, height: 5, borderRadius: 3 },
  optionLabel: { fontSize: 13, fontWeight: "500" },
  optionDesc: { fontSize: 11.5, marginTop: 1 },
  customRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  customInput: { flex: 1, fontSize: 13, paddingVertical: 4, maxHeight: 80 },
  customSubmit: { padding: 4 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 8,
  },
  footBtn: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  dots: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  sendBtn: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
})
