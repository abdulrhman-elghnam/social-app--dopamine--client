import type { JSX } from "react";
import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "../context/auth-context";

import "../global.css";

void SplashScreen.preventAutoHideAsync();

function RootNavigator(): JSX.Element | null {
  const { credentials, loading } = useAuth();

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!credentials} redirectTo="/">
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!credentials} redirectTo="/login">
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout(): JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider config={{ devInfo: { stylingPrinciples: false } }}>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
        <StatusBar style="auto" />
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
