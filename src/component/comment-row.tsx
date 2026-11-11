import { Ionicons } from "@expo/vector-icons";
import { Button, Typography, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";
import type { Author, Comment } from "../api/types";
import { displayName, timeAgo } from "../lib/format";
import { UserAvatar } from "./user-avatar";

interface CommentRowProps {
  comment: Comment;
  fallbackAuthor?: Author | null;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function CommentRow({
  comment,
  fallbackAuthor,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: CommentRowProps): JSX.Element {
  const muted = useThemeColor("muted");
  const author = typeof comment.author === "string" ? fallbackAuthor : comment.author;

  return (
    <View className="flex-row gap-3 py-3">
      {author ? <UserAvatar user={author} size="sm" /> : null}
      <View className="flex-1 gap-1">
        <View className="rounded-2xl bg-surface-secondary px-3.5 py-2.5">
          <Typography type="body-sm" weight="semibold">
            {author ? displayName(author) : "Unknown user"}
          </Typography>
          <Typography.Paragraph type="body-sm">{comment.content}</Typography.Paragraph>
        </View>
        <View className="flex-row items-center gap-1 px-2">
          <Typography.Paragraph type="body-xs" color="muted">
            {timeAgo(comment.createdAt)}
            {comment.editedAt ? " · edited" : ""}
          </Typography.Paragraph>
          <View className="flex-1" />
          {canEdit ? (
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              onPress={onEdit}
              accessibilityLabel="Edit comment"
            >
              <Ionicons name="create-outline" size={16} color={muted} />
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              onPress={onDelete}
              accessibilityLabel="Delete comment"
            >
              <Ionicons name="trash-outline" size={16} color={muted} />
            </Button>
          ) : null}
        </View>
      </View>
    </View>
  );
}
