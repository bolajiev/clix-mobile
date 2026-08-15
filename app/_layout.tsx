import { useEffect, useRef, useState } from "react"
import { Stack, router } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useColorScheme, View, ActivityIndicator, AppState } from "react-native"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet"
import { I18nextProvider, useTranslation } from "react-i18next"
import { useFonts } from "expo-font"
import { SourceSerif4_600SemiBold } from "@expo-google-fonts/source-serif-4/600SemiBold"
import { SourceSerif4_700Bold } from "@expo-google-fonts/source-serif-4/700Bold"
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular"
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium"
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold"
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold"
import { IBMPlexMono_400Regular } from "@expo-google-fonts/ibm-plex-mono/400Regular"
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium"
import i18n from "../src/lib/i18n/config"
import { useConnections } from "../src/stores/connections"
import { useEvents } from "../src/stores/events"
import { useCatalog } from "../src/stores/catalog"
import { useSettings } from "../src/stores/settings"
import { useTheme } from "../src/theme/tokens"
import { ErrorBoundary } from "../src/components/ErrorBoundary"
import { TelemetryConsentModal } from "../src/components/TelemetryConsentModal"
import * as notifications from "../src/lib/notifications"
import { addBreadcrumb, wrap } from "../src/lib/sentry"
import { loadTelemetryConsent, setTelemetryConsent } from "../src/lib/telemetry"
import { initAnalytics, trackAppOpened } from "../src/lib/analytics"

const queryClient = new QueryClient()

function RootLayout() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"
  const theme = useTheme()
  const { t } = useTranslation()

  const [fontsLoaded] = useFonts({
    SourceSerif4_600SemiBold,
    SourceSerif4_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  })

  const { loadConnections, isLoading: connectionsLoading, client } = useConnections()
  const sseStarted = useRef(false)
  const notifPermissionRequested = useRef(false)

  // Telemetry consent state: null = loading, 'unknown' = show modal, else decided
  const [consentState, setConsentState] = useState<"loading" | "unknown" | "decided">("loading")

  useEffect(() => {
    loadConnections()
    useSettings.getState().load()

    // Connect notification preferences to the notification module
    notifications.configure(() => useSettings.getState().notifications)

    // Navigate to session when user taps a notification. Connection-drop
    // notifications carry no sessionId (they aren't about a session) — route
    // to the home tab instead of "/session/" (an empty, dead-end route).
    const unsubNotifications = notifications.onTap((data) => {
      if (data.sessionId) router.push(`/session/${data.sessionId}`)
      else router.push("/")
    })

    // Load telemetry consent — initialise Sentry only if previously granted
    loadTelemetryConsent()
      .then((state) => {
        if (state === "granted") {
          import("../src/lib/sentry").then(({ initSentry }) => {
            initSentry()
            addBreadcrumb({ category: "app.lifecycle", message: "app started" })
          })
          initAnalytics()
          trackAppOpened()
          setConsentState("decided")
        } else if (state === "denied") {
          addBreadcrumb({ category: "app.lifecycle", message: "app started (telemetry off)" })
          setConsentState("decided")
        } else {
          setConsentState("unknown")
        }
      })
      .catch(() => {
        // SecureStore unavailable — show modal so user can decide
        setConsentState("unknown")
      })

    return unsubNotifications
  }, [])

  // Connect/disconnect SSE and load catalog when client changes
  useEffect(() => {
    if (client && !sseStarted.current) {
      sseStarted.current = true
      useEvents.getState().connect()
      useCatalog.getState().load()
      // Request OS notification permission once we have a live connection —
      // the in-context moment the user will start running agent tasks they'll
      // want to be pinged about. Previously this was only ever requested when
      // a user manually toggled a notification switch off→on in Settings; since
      // most categories default on, that path never fired for typical users
      // and send() silently no-op'd on every notification (permission stayed
      // "undetermined"). setup() is idempotent — it won't re-prompt once the
      // OS has a decision — so the ref just avoids redundant calls per session.
      if (!notifPermissionRequested.current) {
        notifPermissionRequested.current = true
        void notifications.setup()
      }
    } else if (!client && sseStarted.current) {
      sseStarted.current = false
      useEvents.getState().disconnect()
    }
    return () => {
      if (sseStarted.current) {
        sseStarted.current = false
        useEvents.getState().disconnect()
      }
    }
  }, [client])

  const isLoading = connectionsLoading || consentState === "loading" || !fontsLoaded

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.cream,
        }}
      >
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    )
  }

  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <QueryClientProvider client={queryClient}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: {
                  backgroundColor: theme.cream,
                },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="connections" />
              <Stack.Screen
                name="session/[id]"
                options={{
                  title: t("session.titleFallback"),
                  presentation: "card",
                  headerShown: true,
                  headerStyle: { backgroundColor: theme.cream },
                  headerTintColor: theme.ink,
                  headerTitleStyle: { color: theme.ink },
                  contentStyle: { backgroundColor: theme.cream },
                }}
              />
              <Stack.Screen
                name="connection/add"
                options={{
                  title: t("nav.addConnectionTitle"),
                  presentation: "modal",
                }}
              />
              <Stack.Screen
                name="connection/[id]"
                options={{
                  title: t("nav.editConnectionTitle"),
                  presentation: "modal",
                }}
              />
            </Stack>
              <StatusBar style={isDark ? "light" : "dark"} />
          </QueryClientProvider>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
      {/* Telemetry consent modal — shown once on first launch */}
      <TelemetryConsentModal
        visible={consentState === "unknown"}
        onAllow={async () => {
          await setTelemetryConsent(true)
          setConsentState("decided")
        }}
        onDecline={async () => {
          await setTelemetryConsent(false)
          setConsentState("decided")
        }}
      />
      </I18nextProvider>
    </ErrorBoundary>
  )
}

export default wrap(RootLayout)
