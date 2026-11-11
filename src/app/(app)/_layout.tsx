import { Stack } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";

export const unstable_settings = { anchor: "(tabs)" };

export default function AppLayout(): JSX.Element {
  const [background, foreground] = useThemeColor(["background", "foreground"]);
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: background },
        headerTintColor: foreground,
        contentStyle: { backgroundColor: background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="post/[postId]" options={{ title: "Post" }} />
      <Stack.Screen name="post/editor" options={{ presentation: "modal", title: "New post" }} />
    </Stack>
  );
}
