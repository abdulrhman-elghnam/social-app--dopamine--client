import { Ionicons } from "@expo/vector-icons";
import { Alert, Typography, useThemeColor } from "heroui-native";
import type { JSX, PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface AuthLayoutProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  /** Server-side error shown above the form. */
  error?: string | null;
}

/** Shared scaffold for the auth screens: brand mark, heading, error banner, scrollable form. */
export function AuthLayout({ title, subtitle, error, children }: AuthLayoutProps): JSX.Element {
  const insets = useSafeAreaInsets();
  const accentForeground = useThemeColor("accent-foreground");

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="grow justify-center px-6 gap-6"
        contentContainerStyle={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }}
      >
        <View className="gap-3">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-accent">
            <Ionicons name="flash" size={28} color={accentForeground} />
          </View>
          <Typography.Heading type="h2">{title}</Typography.Heading>
          {subtitle ? <Typography.Paragraph color="muted">{subtitle}</Typography.Paragraph> : null}
        </View>

        {error ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Something went wrong</Alert.Title>
              <Alert.Description>{error}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        <View className="gap-4">{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
