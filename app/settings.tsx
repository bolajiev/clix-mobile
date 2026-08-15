import { useCallback, useEffect, useState } from "react"
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, Linking } from "react-native"
import { router } from "expo-router"
import { useTranslation } from "react-i18next"
import * as Application from "expo-application"
import { useSettings } from "../src/stores/settings"
import { useConnections } from "../src/stores/connections"
import { categoryMeta, categories, granted as notificationsGranted, type Category } from "../src/lib/notifications"
import { hasTelemetryConsent, setTelemetryConsent } from "../src/lib/telemetry"
import { useTheme } from "../src/theme/tokens"
import { Badge, Group, GroupLabel, Row, ScreenHeader, Segmented, Toggle } from "../src/components/ui"
import { Ionicons } from "@expo/vector-icons"
import { PRIVACY_POLICY_URL, SETUP_GUIDE_URL } from "../src/lib/links"
import type { LocalePreference } from "../src/lib/i18n/locale-resolve"

const CATEGORY_ICONS: Record<Category, string> = {
  permissions: "key-outline",
  questions: "help-circle-outline",
  completed: "checkmark-circle-outline",
  errors: "alert-circle-outline",
  connection: "wifi-outline",
}

const ICONS = {
  connections: "server-outline",
  diagnostics: "document-text-outline",
  privacy: "shield-outline",
  language: "language-outline",
  theme: "color-palette-outline",
  version: "information-circle-outline",
  github: "logo-github",
  docs: "book-outline",
} as const

export default function SettingsScreen() {
  const theme = useTheme()
  const { t } = useTranslation()
  const { notifications, setNotification, locale, setLocale, appearance, setAppearance } = useSettings()
  const activeConnection = useConnections((s) => s.activeConnection)
  const [telemetry, setTelemetry] = useState<boolean | null>(null)
  const [telemetryUpdating, setTelemetryUpdating] = useState(false)
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null)

  useEffect(() => {
    setTelemetry(hasTelemetryConsent())
    void notificationsGranted().then(setNotifGranted)
  }, [])

  const handleToggle = useCallback(
    async (category: Category, enabled: boolean) => {
      if (enabled && !(await notificationsGranted())) {
        Alert.alert(t("settings.alerts.notificationsDisabledTitle"), t("settings.alerts.notificationsDisabledMessage"))
        return
      }
      void setNotification(category, enabled)
    },
    [setNotification, t],
  )

  const handleTelemetry = async (enabled: boolean) => {
    setTelemetryUpdating(true)
    try {
      await setTelemetryConsent(enabled)
      setTelemetry(enabled)
    } finally {
      setTelemetryUpdating(false)
    }
  }

  const localeLabels: Record<LocalePreference, string> = {
    system: t("settings.language.system"),
    en: t("settings.language.en"),
    "zh-Hans": t("settings.language.zhHans"),
  }

  const chooseLocale = () => {
    Alert.alert(t("settings.language.title"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      { text: localeLabels.system, onPress: () => void setLocale("system") },
      { text: localeLabels.en, onPress: () => void setLocale("en") },
    ])
  }

  const appVersion = Application.nativeApplicationVersion || "0.4.12"

  return (
    <View style={{ flex: 1, backgroundColor: theme.cream }}>
      <ScreenHeader title={t("settings.title")} onBack={() => router.back()} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 + 24 }}>
        <GroupLabel label={t("settings.sections.account")} />
        <Group>
          <Row
            icon={<Ionicons name={ICONS.connections} size={18} color={theme.accentDeep} />}
            title={t("settings.account.connections")}
            subtitle={
              activeConnection ? `${activeConnection.url?.replace(/^https?:\/\//, "") || ""} ` : t("settings.account.noConnection")
            }
            right={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {activeConnection ? <Badge label={t("settings.account.connected")} /> : null}
                <Text style={{ fontSize: 18, color: theme.inkFaint }}>›</Text>
              </View>
            }
            onPress={() => router.push("/connections")}
            last
          />
        </Group>

        <GroupLabel label={t("settings.sections.appearance")} />
        <Group>
          <Row
            icon={<Ionicons name={ICONS.theme} size={18} color={theme.accentDeep} />}
            title={t("settings.appearance.title")}
            right={
              <Segmented
                options={["system", "light", "dark"] as const}
                value={appearance}
                onChange={(v) => void setAppearance(v)}
              />
            }
          />
          <Row
            icon={<Ionicons name={ICONS.language} size={18} color={theme.accentDeep} />}
            title={t("settings.language.label")}
            right={<Text style={{ fontSize: 13, color: theme.inkFaint }}>{localeLabels[locale]}</Text>}
            onPress={chooseLocale}
            last
          />
        </Group>

        <GroupLabel label={t("settings.sections.notifications")} />
        <Group>
          {/* Permission requests + Questions are always-on (critical for a
              coding agent) — their cards are intentionally omitted; the
              notifications still fire unconditionally. Only the optional
              categories below are user-toggleable. */}
          {categories
            .filter((c) => c !== "permissions" && c !== "questions")
            .map((category, i, visible) => {
              const meta = categoryMeta[category]
              return (
                <Row
                  key={category}
                  icon={<Ionicons name={CATEGORY_ICONS[category]} size={18} color={theme.accentDeep} />}
                  title={t(meta.labelKey)}
                  subtitle={t(meta.descriptionKey)}
                  right={<Toggle on={notifications[category]} onToggle={() => handleToggle(category, !notifications[category])} />}
                  last={i === visible.length - 1}
                />
              )
            })}
        </Group>
        {notifGranted === false ? (
          <Text style={{ fontSize: 12, color: theme.inkFaint, marginTop: 10, paddingHorizontal: 4, lineHeight: 17 }}>
            {t("settings.notifications.disabledNotice")}
          </Text>
        ) : null}

        <GroupLabel label={t("settings.sections.privacy")} />
        <Group>
          <Row
            icon={<Ionicons name={ICONS.diagnostics} size={18} color={theme.accentDeep} />}
            title={t("settings.privacy.diagnostics")}
            subtitle={t("settings.privacy.diagnosticsSub")}
            right={<Toggle on={!!telemetry} onToggle={() => handleTelemetry(!telemetry)} disabled={telemetryUpdating || telemetry === null} />}
          />
          <Row
            icon={<Ionicons name={ICONS.privacy} size={18} color={theme.accentDeep} />}
            title={t("settings.privacy.privacyPolicy.label")}
            subtitle={t("settings.privacy.privacyPolicy.description")}
            onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
            last
          />
        </Group>

        <GroupLabel label={t("settings.sections.about")} />
        <Group>
          <Row
            icon={<Ionicons name={ICONS.version} size={18} color={theme.accentDeep} />}
            title={t("settings.about.version")}
            right={<Text style={{ fontSize: 13, color: theme.inkFaint }}>{appVersion}</Text>}
          />
          <Row
            icon={<Ionicons name={ICONS.docs} size={18} color={theme.accentDeep} />}
            title={t("settings.about.docs.label")}
            subtitle={t("settings.about.docs.description")}
            onPress={() => void Linking.openURL(SETUP_GUIDE_URL)}
          />
          <Row
            icon={<Ionicons name={ICONS.github} size={18} color={theme.accentDeep} />}
            title={t("settings.about.github.label")}
            subtitle={t("settings.about.github.description")}
            onPress={() => void Linking.openURL("https://github.com/bolajiev/clix-mobile")}
            last
          />
        </Group>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({})
