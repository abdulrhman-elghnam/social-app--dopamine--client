import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Menu, Typography, useThemeColor, useToast } from "heroui-native";
import { useState, type ComponentProps, type JSX } from "react";
import { Pressable, View } from "react-native";
import { postApi } from "../api/posts";
import type { Author, Post, Visibility } from "../api/types";
import { compactCount, displayName, timeAgo } from "../lib/format";
import { emitPostEvent } from "../lib/post-events";
import { errorMessage } from "../services/api";
import { SharePostDialog } from "./share-post-dialog";
import { UserAvatar } from "./user-avatar";

type IconName = ComponentProps<typeof Ionicons>["name"];

export const VISIBILITY_META: Record<Visibility, { label: string; icon: IconName }> = {
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
  /** Open the author's profile. */
  onAuthorPress?: () => void;
  /** Shown to non-owners. */
  onReport?: () => void;
  /** Show full content instead of a 6-line preview. */
  expanded?: boolean;
}

/**
 * A post with its action bar. Like, save and share talk to the server directly and broadcast the
 * new counters through `post-events`, so every list holding this post updates (optimistically).
 */
export function PostCard({
  post,
  fallbackAuthor,
  isOwner,
  onPress,
  onEdit,
  onDelete,
  onAuthorPress,
  onReport,
  expanded = false,
}: PostCardProps): JSX.Element {
  const { toast } = useToast();
  const [muted, danger, accent] = useThemeColor(["muted", "danger", "accent"]);
  const [liking, setLiking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);

  const author = typeof post.author === "string" ? fallbackAuthor : post.author;
  const visibility = VISIBILITY_META[post.visibility];
  const liked = !!post.isLiked;
  const saved = !!post.isSaved;
  // The server only lets public posts (or your own) be shared.
  const canShare = post.visibility === "public" || isOwner;
  const hasMenu = isOwner ? !!(onEdit || onDelete) : !!onReport;

  async function toggleLike(): Promise<void> {
    if (liking) return;
    const before = { isLiked: liked, likesCount: post.likesCount };
    setLiking(true);
    emitPostEvent({
      type: "updated",
      post: {
        _id: post._id,
        isLiked: !liked,
        likesCount: Math.max(0, post.likesCount + (liked ? -1 : 1)),
      },
    });
    try {
      const { data } = liked ? await postApi.unlike(post._id) : await postApi.like(post._id);
      if (data)
        emitPostEvent({
          type: "updated",
          post: { _id: post._id, isLiked: data.isLiked, likesCount: data.likesCount },
        });
    } catch (error) {
      emitPostEvent({ type: "updated", post: { _id: post._id, ...before } });
      toast.show({
        variant: "danger",
        label: "Couldn't update like",
        description: errorMessage(error),
      });
    } finally {
      setLiking(false);
    }
  }

  async function toggleSave(): Promise<void> {
    if (saving) return;
    setSaving(true);
    emitPostEvent({ type: "updated", post: { _id: post._id, isSaved: !saved } });
    try {
      if (saved) await postApi.unsave(post._id);
      else await postApi.save(post._id);
      toast.show({ variant: "default", label: saved ? "Removed from saved" : "Saved" });
    } catch (error) {
      emitPostEvent({ type: "updated", post: { _id: post._id, isSaved: saved } });
      toast.show({
        variant: "danger",
        label: "Couldn't update saved",
        description: errorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={onAuthorPress}
          disabled={!onAuthorPress}
          accessibilityRole="button"
          accessibilityLabel={author ? `Open ${displayName(author)}'s profile` : undefined}
          className="flex-1 flex-row items-center gap-3"
        >
          {author ? <UserAvatar user={author} /> : null}
          <View className="flex-1">
            <Typography weight="semibold" truncate>
              {author ? displayName(author) : "Unknown user"}
            </Typography>
            <View className="flex-row items-center gap-1">
              <Typography.Paragraph type="body-xs" color="muted" numberOfLines={1}>
                {author ? `@${author.username} · ` : ""}
                {timeAgo(post.createdAt)}
                {post.editedAt ? " · edited" : ""} ·
              </Typography.Paragraph>
              <Ionicons
                name={visibility.icon}
                size={12}
                color={muted}
                accessibilityLabel={visibility.label}
              />
            </View>
          </View>
        </Pressable>

        {hasMenu ? (
          <Menu>
            <Menu.Trigger asChild>
              <Button variant="ghost" size="sm" isIconOnly accessibilityLabel="Post options">
                <Ionicons name="ellipsis-horizontal" size={18} color={muted} />
              </Button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Overlay />
              <Menu.Content presentation="popover" width={180}>
                {isOwner && onEdit ? (
                  <Menu.Item onPress={onEdit}>
                    <Ionicons name="create-outline" size={16} color={muted} />
                    <Menu.ItemTitle>Edit</Menu.ItemTitle>
                  </Menu.Item>
                ) : null}
                {isOwner && onDelete ? (
                  <Menu.Item variant="danger" onPress={onDelete}>
                    <Ionicons name="trash-outline" size={16} color={danger} />
                    <Menu.ItemTitle>Delete</Menu.ItemTitle>
                  </Menu.Item>
                ) : null}
                {!isOwner && onReport ? (
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

      {post.content ? (
        <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button">
          <Typography.Paragraph numberOfLines={expanded ? undefined : 6}>
            {post.content}
          </Typography.Paragraph>
        </Pressable>
      ) : null}

      <View className="-mx-2 flex-row items-center border-t border-separator pt-1">
        <Action
          icon={liked ? "heart" : "heart-outline"}
          color={liked ? danger : muted}
          label={compactCount(post.likesCount)}
          accessibilityLabel={liked ? "Unlike" : "Like"}
          selected={liked}
          onPress={toggleLike}
        />
        <Action
          icon="chatbubble-outline"
          color={muted}
          label={post.commentsEnabled ? compactCount(post.commentsCount) : "Off"}
          accessibilityLabel={
            post.commentsEnabled ? `${post.commentsCount} comments` : "Comments are off"
          }
          onPress={onPress}
        />
        <Action
          icon="arrow-redo-outline"
          color={muted}
          label={compactCount(post.sharesCount)}
          accessibilityLabel={canShare ? "Share" : "Only public posts can be shared"}
          onPress={canShare ? () => setSharing(true) : undefined}
        />
        <View className="flex-1" />
        <Action
          icon={saved ? "bookmark" : "bookmark-outline"}
          color={saved ? accent : muted}
          accessibilityLabel={saved ? "Remove from saved" : "Save"}
          selected={saved}
          onPress={toggleSave}
        />
      </View>

      <SharePostDialog
        post={sharing ? post : null}
        onClose={() => setSharing(false)}
        onShared={(sharesCount) =>
          emitPostEvent({ type: "updated", post: { _id: post._id, sharesCount } })
        }
      />
    </Card>
  );
}

interface ActionProps {
  icon: IconName;
  color: string;
  label?: string;
  accessibilityLabel: string;
  selected?: boolean;
  onPress?: (() => void) | undefined;
}

function Action({
  icon,
  color,
  label,
  accessibilityLabel,
  selected,
  onPress,
}: ActionProps): JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!selected, disabled: !onPress }}
      className="flex-row items-center gap-1.5 rounded-full px-2.5 py-2 active:bg-surface-secondary"
      style={{ opacity: onPress ? 1 : 0.5 }}
    >
      <Ionicons name={icon} size={19} color={color} />
      {label !== undefined ? (
        <Typography type="body-sm" weight="medium" style={{ color }}>
          {label}
        </Typography>
      ) : null}
    </Pressable>
  );
}
