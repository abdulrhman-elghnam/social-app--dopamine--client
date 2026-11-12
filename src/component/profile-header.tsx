import { Ionicons } from "@expo/vector-icons";
import { Spinner, Typography, useThemeColor } from "heroui-native";
import type { JSX, ReactNode } from "react";
import { Image, Pressable, View } from "react-native";
import type { Author, Privacy } from "../api/types";
import { compactCount, displayName } from "../lib/format";
import { fileUrl } from "../services/api";
import { UserAvatar } from "./user-avatar";

export interface ProfileHeaderUser extends Author {
  bio?: string;
  coverImage?: string;
  privacyController: Privacy;
  postsCount: number;
  followersCount: number;
  followingCount: number;
}

interface ProfileHeaderProps {
  user: ProfileHeaderUser;
  /** Small line under the handle, e.g. "Follows you". */
  note?: string | undefined;
  isOnline?: boolean | undefined;
  /** Makes the avatar / cover tappable (your own profile) and shows a camera badge. */
  onAvatarPress?: (() => void) | undefined;
  onCoverPress?: (() => void) | undefined;
  avatarBusy?: boolean;
  coverBusy?: boolean;
  onPostsPress?: (() => void) | undefined;
  onFollowersPress?: (() => void) | undefined;
  onFollowingPress?: (() => void) | undefined;
  /** Buttons under the stats (Follow / Message, Edit profile …). */
  actions?: ReactNode;
}

const COVER_HEIGHT = 140;

/** Cover photo, overlapping avatar, name, bio, counters and an action row. */
export function ProfileHeader({
  user,
  note,
  isOnline,
  onAvatarPress,
  onCoverPress,
  avatarBusy = false,
  coverBusy = false,
  onPostsPress,
  onFollowersPress,
  onFollowingPress,
  actions,
}: ProfileHeaderProps): JSX.Element {
  const [muted, accentForeground, foreground] = useThemeColor([
    "muted",
    "accent-foreground",
    "foreground",
  ]);
  const cover = fileUrl(user.coverImage);

  return (
    <View className="overflow-hidden rounded-3xl border border-separator bg-surface">
      <Pressable
        onPress={onCoverPress}
        disabled={!onCoverPress || coverBusy}
        accessibilityRole={onCoverPress ? "button" : undefined}
        accessibilityLabel={onCoverPress ? "Change cover photo" : undefined}
        style={{ height: COVER_HEIGHT }}
        className="bg-accent/15"
      >
        {cover ? (
          <Image
            key={cover}
            source={{ uri: cover }}
            style={{ width: "100%", height: COVER_HEIGHT }}
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="sparkles-outline" size={28} color={muted} />
          </View>
        )}
        {coverBusy ? (
          <View className="absolute inset-0 items-center justify-center bg-black/40">
            <Spinner color="white" />
          </View>
        ) : null}
        {onCoverPress && !coverBusy ? (
          <View className="absolute bottom-3 right-3 flex-row items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5">
            <Ionicons name="image-outline" size={14} color="white" />
            <Typography type="body-xs" weight="semibold" style={{ color: "white" }}>
              {cover ? "Change cover" : "Add cover"}
            </Typography>
          </View>
        ) : null}
      </Pressable>

      <View className="gap-3 px-5 pb-5">
        <View className="-mt-12 flex-row items-end justify-between">
          <Pressable
            onPress={onAvatarPress}
            disabled={!onAvatarPress || avatarBusy}
            accessibilityRole={onAvatarPress ? "button" : undefined}
            accessibilityLabel={onAvatarPress ? "Change profile photo" : undefined}
            accessibilityState={{ busy: avatarBusy }}
            className="rounded-full border-4 border-surface"
          >
            <UserAvatar user={user} size="xl" />
            {avatarBusy ? (
              <View className="absolute inset-0 items-center justify-center rounded-full bg-black/40">
                <Spinner color="white" />
              </View>
            ) : null}
            {onAvatarPress && !avatarBusy ? (
              <View className="absolute bottom-0 right-0 size-8 items-center justify-center rounded-full border-2 border-surface bg-accent">
                <Ionicons name="camera" size={15} color={accentForeground} />
              </View>
            ) : null}
            {isOnline ? (
              <View className="absolute bottom-1.5 right-1.5 size-5 rounded-full border-[3px] border-surface bg-success" />
            ) : null}
          </Pressable>
        </View>

        <View className="gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <Typography.Heading type="h4" className="shrink">
              {displayName(user)}
            </Typography.Heading>
            {user.privacyController === "private" ? (
              <Ionicons
                name="lock-closed"
                size={14}
                color={foreground}
                accessibilityLabel="Private account"
              />
            ) : null}
          </View>
          <Typography.Paragraph color="muted">
            @{user.username}
            {note ? ` · ${note}` : ""}
          </Typography.Paragraph>
        </View>

        {user.bio ? <Typography.Paragraph>{user.bio}</Typography.Paragraph> : null}

        <View className="flex-row rounded-2xl bg-surface-secondary py-3">
          <Stat value={user.postsCount} label="Posts" onPress={onPostsPress} />
          <View className="w-px bg-separator" />
          <Stat value={user.followersCount} label="Followers" onPress={onFollowersPress} />
          <View className="w-px bg-separator" />
          <Stat value={user.followingCount} label="Following" onPress={onFollowingPress} />
        </View>

        {actions ? <View className="flex-row gap-2">{actions}</View> : null}
      </View>
    </View>
  );
}

function Stat({
  value,
  label,
  onPress,
}: {
  value: number | undefined;
  label: string;
  onPress?: (() => void) | undefined;
}): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-1 items-center gap-0.5"
      accessibilityRole="button"
      accessibilityLabel={`${value ?? 0} ${label}`}
    >
      <Typography.Heading type="h5">{compactCount(value ?? 0)}</Typography.Heading>
      <Typography.Paragraph type="body-xs" color="muted">
        {label}
      </Typography.Paragraph>
    </Pressable>
  );
}
