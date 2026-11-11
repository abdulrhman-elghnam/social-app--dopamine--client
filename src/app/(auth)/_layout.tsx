import { Stack } from "expo-router";
import type { JSX } from "react";

// Default screen of the signed-out group (e.g. when "/" is opened while signed out).
export const unstable_settings = { anchor: "login" };

export default function AuthLayout(): JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="verify-email" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
