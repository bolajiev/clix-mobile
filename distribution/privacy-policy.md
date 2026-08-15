# Clix — Privacy Policy

**Effective date:** 2026-08-14
**App:** Clix (`com.clix.mobile`)

> **Summary:** Clix does not collect your code, prompts, AI responses, server URLs, or any chat content. All AI traffic goes directly from the app to **your own opencode server** — Clix never sees it. With your explicit consent, the app uses Sentry for anonymous crash diagnostics and PostHog for anonymous usage analytics, and — only when you tap "Share Report" — delivers a scrubbed copy of a diagnostic report to our support inbox. Notifications are local and on-device. There is no account, no telemetry without consent, and no data sold.

---

## 1. Who We Are

Clix is an open-source (MIT) Android client for the opencode AI coding agent, published by the app's maintainers. The app runs against your own self-hosted opencode server.

- Contact: support@bolajiev.com
- Source code: https://github.com/bolajiev/clix-mobile (MIT license)

## 2. Data We Do NOT Collect

We never collect, transmit to our servers, or share with third parties:

- Your code, files, or repository content
- Your prompts, chat messages, or AI responses
- Your opencode server URL, IP address, or hostname
- Authentication tokens, API keys, or credentials you enter
- Account information or names
- Location data
- Photos, microphone recordings, or camera data — these are processed **on your device** and sent only to your own opencode server if you attach them to a message
- Contacts, calendar, or any other personal data

All communication between the app and your AI coding agent travels **directly between your device and your self-hosted opencode server**. Clix's maintainers never see this traffic.

## 3. Data We Collect (only with your consent)

### 3a. Crash reporting & usage analytics (opt-in, off by default)

In **Settings → Privacy**, the app offers a "Share diagnostics" toggle. It is **off by default**. If you turn it on:

- **Sentry** receives anonymous crash reports (app errors and stack traces) for stability analysis.
- **PostHog** receives anonymous usage events (screen views, feature usage). No code, prompts, server URLs, or credentials are included.

### 3b. Shared diagnostic reports (opt-in, on demand)

If a connection fails or the app crashes, you can tap **Share Report** to open your device's normal share sheet with a diagnostic report. A copy of that report is delivered to our support inbox (self-hosted Chatwoot) only when you explicitly share it. Reports are scrubbed of credentials and server URLs before sharing.

### 3c. Notifications (on-device)

Clix can show local notifications (permission requests, questions, task completions, errors, connection drops). These are generated and stored **on your device only**; Clix does not operate a push-notification service.

## 4. Third Parties We Use

- **Sentry** (crash reporting) — used only if you enable "Share diagnostics". Privacy: https://sentry.io/privacy/
- **PostHog** (usage analytics) — used only if you enable "Share diagnostics". Privacy: https://posthog.com/privacy
- **Chatwoot** (self-hosted support inbox) — receives a diagnostic report only when you explicitly tap Share Report.

There is no ad network, no data broker, and no sale or rental of any data.

## 5. Retention

- Sentry crash events: ~90 days (Sentry default).
- PostHog events: per PostHog's standard retention.
- Shared support reports: retained until the conversation is resolved and periodically purged.

## 6. Your Rights & Choices

- **Opt out** — disable "Share diagnostics" at any time in **Settings → Privacy**.
- **Notifications** — manage per-category or disable entirely in **Settings → Notifications** or the OS notification settings.
- **Request deletion** — email support@bolajiev.com with subject "Data deletion request"; we will delete any crash events, analytics events, or shared reports associated with your device.

## 7. Changes

If this policy changes, the updated version will be posted here with a new effective date.

---
*Clix Mobile — Privacy Policy*
