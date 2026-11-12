import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { ComponentProps, JSX } from "react";
import { useRealtime } from "../../../context/realtime-context";
import type { ColorValue } from "react-native";

export const unstable_settings = { anchor: "index" };

type IoniconName = ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, color }: { name: IoniconName; color: ColorValue }): JSX.Element {
  // RN 0.88's `ColorValue` also admits `null` and processed numbers, which Ionicons rejects.
  const iconColor = color === null || typeof color === "number" ? undefined : color;
  return <Ionicons name={name} size={24} color={iconColor} />;
}

export default function TabsLayout(): JSX.Element {
  const [background, accent, muted, separator] = useThemeColor([
    "background",
    "accent",
    "muted",
    "separator",
  ]);
  const { unreadChats } = useRealtime();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: muted,
        tabBarStyle: { backgroundColor: background, borderTopColor: separator },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Posts",
          tabBarIcon: ({ color }) => <TabIcon name="newspaper-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color }) => <TabIcon name="compass-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarIcon: ({ color }) => <TabIcon name="chatbubbles-outline" color={color} />,
          tabBarBadge: unreadChats > 0 ? unreadChats : undefined,
          tabBarBadgeStyle: { backgroundColor: accent },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <TabIcon name="person-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
