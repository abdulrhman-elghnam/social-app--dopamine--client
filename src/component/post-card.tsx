import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Chip, Typography, useThemeColor } from "heroui-native";
import type { ComponentProps, JSX } from "react";
import { Pressable, View } from "react-native";
import type { Author, Post, Visibility } from "../api/types";
import { displayName, timeAgo } from "../lib/format";
import { UserAvatar } from "./user-avatar";

export const VISIBILITY_META: Record<
  Visibility,
  { label: string; icon: ComponentProps<typeof Ionicons>["name"] }
> = {
  public: { label: "Public", icon: "earth-outline" },
  followers: { label: "Followers", icon: "people-outline" },
  private: { label: "Only me", icon: "lock-closed-outline" },
};

interface PostCardProps {
  post: Post;
  /** Fallback author when the server returned only an id (create/update responses). */
  fallbackAuthor?: Author | null;
  isOwner: boolean;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Show full content instead of a 6-line preview. */
  expanded?: boolean;
}

export function PostCard({
  post,
  fallbackAuthor,
  isOwner,
  onPress,
  onEdit,
  onDelete,
  expanded = false,
}: PostCardProps): JSX.Element {
  const muted = useThemeColor("muted");
  const author = typeof post.author === "string" ? fallbackAuthor : post.author;
  const visibility = VISIBILITY_META[post.visibility];

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        {author ? <UserAvatar user={author} /> : null}
        <View className="flex-1">
          <Typography weight="semibold" truncate>
            {author ? displayName(author) : "Unknown user"}
          </Typography>
          <View className="flex-row items-center gap-1.5">
            <Typography.Paragraph type="body-xs" color="muted">
              {author ? `@${author.username} · ` : ""}
              {timeAgo(post.createdAt)}
              {post.editedAt ? " · edited" : ""}
            </Typography.Paragraph>
          </View>
        </View>
        <Chip size="sm" variant="soft" color="default">
          <Ionicons name={visibility.icon} size={12} color={muted} />
          <Chip.Label>{visibility.label}</Chip.Label>
        </Chip>
      </View>

      <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button">
        <Typography.Paragraph numberOfLines={expanded ? undefined : 6}>
          {post.content}
        </Typography.Paragraph>
      </Pressable>

      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          className="flex-row items-center gap-1.5 py-1"
          accessibilityLabel={`${post.commentsCount} comments`}
        >
          <Ionicons name="chatbubble-outline" size={16} color={muted} />
          <Typography.Paragraph type="body-sm" color="muted">
            {post.commentsEnabled
              ? `${post.commentsCount} ${post.commentsCount === 1 ? "comment" : "comments"}`
              : "Comments off"}
          </Typography.Paragraph>
        </Pressable>

        {isOwner ? (
          <View className="flex-row gap-1">
            {onEdit ? (
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={onEdit}
                accessibilityLabel="Edit post"
              >
                <Ionicons name="create-outline" size={18} color={muted} />
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={onDelete}
                accessibilityLabel="Delete post"
              >
                <Ionicons name="trash-outline" size={18} color={muted} />
              </Button>
            ) : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}
