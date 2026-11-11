import { Ionicons } from "@expo/vector-icons";
import { Button, Spinner, Typography, useThemeColor } from "heroui-native";
import type { ComponentProps, JSX } from "react";
import { View } from "react-native";

export function LoadingView(): JSX.Element {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Spinner size="lg" />
    </View>
  );
}

interface EmptyStateProps {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps): JSX.Element {
  const muted = useThemeColor("muted");
  return (
    <View className="items-center gap-3 px-8 py-16">
      <Ionicons name={icon} size={40} color={muted} />
      <Typography.Heading type="h5" align="center">
        {title}
      </Typography.Heading>
      {description ? (
        <Typography.Paragraph color="muted" align="center">
          {description}
        </Typography.Paragraph>
      ) : null}
      {actionLabel && onAction ? (
        <Button size="sm" variant="secondary" onPress={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}
