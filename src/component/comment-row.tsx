import { Ionicons } from "@expo/vector-icons";
import { Button, Menu, Typography, useThemeColor, useToast } from "heroui-native";
import { useState, type JSX } from "react";
import { Pressable, View } from "react-native";
import { commentApi } from "../api/posts";
import type { Author, Comment } from "../api/types";
import { compactCount, displayName, timeAgo } from "../lib/format";
import { errorMessage } from "../services/api";
import { UserAvatar } from "./user-avatar";

interface CommentRowProps {
  comment: Comment;
  fallbackAuthor?: Author | null;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAuthorPress?: () => void;
  /** Shown when set (pass it for other people's comments). */
  onReport?: (() => void) | undefined;
  /** Shown when set; replies to a reply attach to its top-level comment on the server. */
  onReply?: (() => void) | undefined;
  /** Indented, smaller avatar. */
  isReply?: boolean;
}

/** A comment bubble with like / reply actions and an owner or report menu. */
export function CommentRow({
  comment,
  fallbackAuthor,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onAuthorPress,
  onReport,
  onReply,
  isReply = false,
}: CommentRowProps): JSX.Element {
  const { toast } = useToast();
  const [muted, danger] = useThemeColor(["muted", "danger"]);
  const author = typeof comment.author === "string" ? fallbackAuthor : comment.author;

  // Likes are local to the row: nothing else on screen shows a comment's like state.
  const [like, setLike] = useState({
    isLiked: !!comment.isLiked,
    likesCount: comment.likesCount ?? 0,
  });
  const [liking, setLiking] = useState(false);

  async function toggleLike(): Promise<void> {
    if (liking) return;
    const before = like;
    setLiking(true);
    setLike({
      isLiked: !before.isLiked,
      likesCount: Math.max(0, before.likesCount + (before.isLiked ? -1 : 1)),
    });
    try {
      const { data } = before.isLiked
        ? await commentApi.unlike(comment._id)
        : await commentApi.like(comment._id);
      if (data) setLike({ isLiked: data.isLiked, likesCount: data.likesCount });
    } catch (error) {
      setLike(before);
      toast.show({
        variant: "danger",
        label: "Couldn't update like",
        description: errorMessage(error),
      });
    } finally {
      setLiking(false);
    }
  }

  const hasMenu = canEdit || canDelete || !!onReport;

  return (
    <View className={isReply ? "flex-row gap-2.5 py-2 pl-11" : "flex-row gap-3 py-3"}>
      {author ? (
        <Pressable
          onPress={onAuthorPress}
          disabled={!onAuthorPress}
          accessibilityRole="button"
          accessibilityLabel={`Open ${displayName(author)}'s profile`}
        >
          <UserAvatar user={author} size="sm" />
        </Pressable>
      ) : null}
      <View className="flex-1 gap-1">
        <View className="self-start rounded-2xl rounded-tl-md bg-surface-secondary px-3.5 py-2.5">
          <Pressable onPress={onAuthorPress} disabled={!onAuthorPress} className="self-start">
            <Typography type="body-sm" weight="semibold">
              {author ? displayName(author) : "Unknown user"}
            </Typography>
          </Pressable>
          <Typography.Paragraph type="body-sm">{comment.content}</Typography.Paragraph>
        </View>
        <View className="flex-row items-center gap-3 px-2">
          <Typography.Paragraph type="body-xs" color="muted">
            {timeAgo(comment.createdAt)}
            {comment.editedAt ? " · edited" : ""}
          </Typography.Paragraph>
          <Pressable
            onPress={toggleLike}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={like.isLiked ? "Unlike comment" : "Like comment"}
            accessibilityState={{ selected: like.isLiked }}
            className="flex-row items-center gap-1"
          >
            <Ionicons
              name={like.isLiked ? "heart" : "heart-outline"}
              size={14}
              color={like.isLiked ? danger : muted}
            />
            {like.likesCount ? (
              <Typography
                type="body-xs"
                weight="medium"
                style={{ color: like.isLiked ? danger : muted }}
              >
                {compactCount(like.likesCount)}
              </Typography>
            ) : null}
          </Pressable>
          {onReply ? (
            <Pressable onPress={onReply} hitSlop={8} accessibilityRole="button">
              <Typography type="body-xs" weight="semibold" color="muted">
                Reply
              </Typography>
            </Pressable>
          ) : null}
          <View className="flex-1" />
          {hasMenu ? (
            <Menu>
              <Menu.Trigger asChild>
                <Button variant="ghost" size="sm" isIconOnly accessibilityLabel="Comment options">
                  <Ionicons name="ellipsis-horizontal" size={16} color={muted} />
                </Button>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Overlay />
                <Menu.Content presentation="popover" width={170}>
                  {canEdit ? (
                    <Menu.Item onPress={onEdit}>
                      <Ionicons name="create-outline" size={16} color={muted} />
                      <Menu.ItemTitle>Edit</Menu.ItemTitle>
                    </Menu.Item>
                  ) : null}
                  {canDelete ? (
                    <Menu.Item variant="danger" onPress={onDelete}>
                      <Ionicons name="trash-outline" size={16} color={danger} />
                      <Menu.ItemTitle>Delete</Menu.ItemTitle>
                    </Menu.Item>
                  ) : null}
                  {onReport ? (
                    <Menu.Item variant="danger" onPress={onReport}>
                      <Ionicons name="flag-outline" size={16} color={danger} />
                      <Menu.ItemTitle>Report</Menu.ItemTitle>
                    </Menu.Item>
                  ) : null}
                </Menu.Content>
              </Menu.Portal>
            </Menu>
          ) : null}
        </View>
      </View>
    </View>
  );
}
