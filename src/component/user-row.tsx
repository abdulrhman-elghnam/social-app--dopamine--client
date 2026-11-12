import { Typography } from "heroui-native";
import type { JSX, ReactNode } from "react";
import { Pressable, View } from "react-native";
import type { Author } from "../api/types";
import { displayName } from "../lib/format";
import { UserAvatar } from "./user-avatar";

interface UserRowProps {
  user: Author & { bio?: string };
  onPress?: () => void;
  /** Secondary line; defaults to `@username`. */
  subtitle?: string;
  showBio?: boolean;
  /** Green dot on the avatar. */
  isOnline?: boolean;
  /** Buttons/checkbox on the right. */
  accessory?: ReactNode;
}

export function UserRow({
  user,
  onPress,
  subtitle,
  showBio = false,
  isOnline = false,
  accessory,
}: UserRowProps): JSX.Element {
  return (
    <View className="flex-row items-center gap-3 py-2.5">
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={displayName(user)}
        className="flex-1 flex-row items-center gap-3"
      >
        <View>
          <UserAvatar user={user} />
          {isOnline ? (
            <View className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-background bg-success" />
          ) : null}
        </View>
        <View className="flex-1">
          <Typography weight="semibold" truncate>
            {displayName(user)}
          </Typography>
          <Typography.Paragraph type="body-xs" color="muted" numberOfLines={1}>
            {subtitle ?? `@${user.username}`}
          </Typography.Paragraph>
          {showBio && user.bio ? (
            <Typography.Paragraph type="body-sm" numberOfLines={2}>
              {user.bio}
            </Typography.Paragraph>
          ) : null}
        </View>
      </Pressable>
      {accessory}
    </View>
  );
}
