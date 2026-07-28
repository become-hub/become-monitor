# Sentry (logging only)

Become Monitor uses Sentry for **non-blocking** logs and exception reports. Tracing, session replay, profiling, and app-hang tracking are disabled so BLE / foreground monitoring are not stalled.

## Setup

1. Copy `.env.example` → `.env.local` (or set EAS secrets).
2. Set `EXPO_PUBLIC_SENTRY_DSN` from [Sentry → react-native → Client Keys](https://sentry.io/settings/stridegate/projects/react-native/keys/).
3. For Release builds that upload source maps, set `SENTRY_AUTH_TOKEN` (local `.env.local` or EAS secret). Never commit the token.
4. Rebuild the native app after adding `@sentry/react-native` (`npx expo prebuild` / `expo run:android` / CI).

Org: `stridegate` · Project: `react-native`

## Usage

```ts
import { logToSentry, captureException } from "@/services/sentry";

logToSentry("Polar connected", "info", { deviceId: "…" });
captureException(err, { phase: "ftu" });
```

Both helpers swallow SDK failures so logging never changes control flow.

Without `EXPO_PUBLIC_SENTRY_DSN`, init is a no-op.
