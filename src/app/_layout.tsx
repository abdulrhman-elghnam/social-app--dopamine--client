import type { JSX } from "react";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider, useThemeColor } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "../context/auth-context";
import { restoreThemePreference, useThemePreference } from "../lib/theme";

import "../global.css";

void SplashScreen.preventAutoHideAsync();

function RootNavigator(): JSX.Element | null {
  const { credentials, loading } = useAuth();
  const [themeReady, setThemeReady] = useState(false);
  const background = useThemeColor("background");

  // Apply the saved theme before the splash hides, so there's no flash of the wrong one.
  useEffect(() => {
    void restoreThemePreference().finally(() => setThemeReady(true));
  }, []);

  const ready = !loading && themeReady;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }}>
      <Stack.Protected guard={!credentials} redirectTo="/">
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!credentials} redirectTo="/login">
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

/** Status bar icons contrast with the app theme (not the device's), so a pinned theme looks right. */
function ThemedStatusBar(): JSX.Element {
  const { theme } = useThemePreference();
  return <StatusBar style={theme === "dark" ? "light" : "dark"} />;
}

export default function RootLayout(): JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider config={{ devInfo: { stylingPrinciples: false } }}>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
        <ThemedStatusBar />
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
