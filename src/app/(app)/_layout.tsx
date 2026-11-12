import { Stack } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { RealtimeProvider } from "../../context/realtime-context";

export const unstable_settings = { anchor: "(tabs)" };

export default function AppLayout(): JSX.Element {
  const [background, foreground] = useThemeColor(["background", "foreground"]);
  return (
    <RealtimeProvider>
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
        <Stack.Screen name="user/[userId]" options={{ title: "Profile" }} />
        <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
        <Stack.Screen name="follow-requests" options={{ title: "Follow requests" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen
          name="edit-profile"
          options={{ presentation: "modal", title: "Edit profile" }}
        />
        <Stack.Screen name="change-password" options={{ title: "Change password" }} />
        <Stack.Screen name="reports" options={{ title: "Reports" }} />
        <Stack.Screen name="chat/new" options={{ presentation: "modal", title: "New chat" }} />
        <Stack.Screen name="chat/[conversationId]/index" options={{ title: "" }} />
        <Stack.Screen name="chat/[conversationId]/info" options={{ title: "Info" }} />
      </Stack>
    </RealtimeProvider>
  );
}
