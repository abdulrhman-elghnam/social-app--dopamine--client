import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Button, Input, Separator, Typography, useThemeColor, useToast } from "heroui-native";
import { useCallback, useEffect, useState, type JSX } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { commentApi, postApi } from "../../../api/posts";
import { authorId, type Comment, type Post } from "../../../api/types";
import { CommentRow } from "../../../component/comment-row";
import { ConfirmDialog } from "../../../component/confirm-dialog";
import { PostCard } from "../../../component/post-card";
import { EmptyState, LoadingView } from "../../../component/state-views";
import { useAuth } from "../../../context/auth-context";
import { usePaginatedList } from "../../../hook/use-paginated-list";
import { emitPostEvent, usePostEvents } from "../../../lib/post-events";
import { validate } from "../../../lib/validation";
import { errorMessage } from "../../../services/api";

type PendingDelete = { kind: "post" } | { kind: "comment"; comment: Comment };

export default function PostDetailScreen(): JSX.Element {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { userId, profile } = useAuth();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const [accentForeground, muted] = useThemeColor(["accent-foreground", "muted"]);

  const [post, setPost] = useState<Post | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  const fetcher = useCallback(
    (page: number, size: number) => commentApi.list(postId, page, size),
    [postId]
  );
  const comments = usePaginatedList<Comment>(fetcher, 15);
  const { setItems: setComments } = comments;

  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    postApi
      .get(postId)
      .then(setPost)
      .catch((error) => setPostError(errorMessage(error, "This post isn't available")));
  }, [postId]);

  // Edits made in the editor modal.
  usePostEvents((event) => {
    if (event.type === "updated" && event.post._id === postId)
      setPost((current) =>
        current ? { ...current, ...event.post, author: current.author } : current
      );
  });

  const isPostOwner = !!post && authorId(post.author) === userId;

  const changeCommentCount = (delta: 1 | -1) =>
    setPost((current) => {
      if (!current) return current;
      const commentsCount = Math.max(0, current.commentsCount + delta);
      emitPostEvent({ type: "updated", post: { _id: current._id, commentsCount } });
      return { ...current, commentsCount };
    });

  async function send(): Promise<void> {
    const error = validate.commentContent(draft);
    if (error) {
      toast.show({ variant: "warning", label: error });
      return;
    }
    setSending(true);
    try {
      if (editing) {
        const updated = await commentApi.update(editing._id, draft.trim());
        setComments((items) =>
          items.map((item) =>
            item._id === updated._id ? { ...item, ...updated, author: item.author } : item
          )
        );
        setEditing(null);
      } else {
        const created = await commentApi.create(postId, draft.trim());
        setComments((items) => [created, ...items]);
        changeCommentCount(1);
      }
      setDraft("");
    } catch (err) {
      toast.show({
        variant: "danger",
        label: "Couldn't send comment",
        description: errorMessage(err),
      });
    } finally {
      setSending(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      if (pendingDelete.kind === "post") {
        await postApi.remove(postId);
        emitPostEvent({ type: "deleted", postId });
        toast.show({ variant: "success", label: "Post deleted" });
        setPendingDelete(null);
        router.back();
        return;
      }
      const { comment } = pendingDelete;
      await commentApi.remove(comment._id);
      setComments((items) => items.filter((item) => item._id !== comment._id));
      changeCommentCount(-1);
      if (editing?._id === comment._id) {
        setEditing(null);
        setDraft("");
      }
      setPendingDelete(null);
    } catch (err) {
      toast.show({ variant: "danger", label: "Couldn't delete", description: errorMessage(err) });
    } finally {
      setDeleting(false);
    }
  }

  if (postError) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState
          icon="eye-off-outline"
          title="Post unavailable"
          description={postError}
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }
  if (!post) return <LoadingView />;

  const canComment = post.commentsEnabled;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <Stack.Screen options={{ title: "Post" }} />
      <FlatList
        data={comments.items}
        keyExtractor={(comment) => comment._id}
        contentContainerClassName="px-4 pb-4"
        ListHeaderComponent={
          <View className="gap-4 pb-2 pt-3">
            <PostCard
              post={post}
              fallbackAuthor={profile}
              isOwner={isPostOwner}
              expanded
              onEdit={() => router.push({ pathname: "/post/editor", params: { postId } })}
              onDelete={() => setPendingDelete({ kind: "post" })}
            />
            <Typography.Heading type="h6">
              Comments{post.commentsCount ? ` · ${post.commentsCount}` : ""}
            </Typography.Heading>
            {comments.error ? (
              <Typography.Paragraph type="body-sm" className="text-danger">
                {comments.error}
              </Typography.Paragraph>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const mine = authorId(item.author) === userId;
          return (
            <CommentRow
              comment={item}
              fallbackAuthor={profile}
              canEdit={mine}
              canDelete={mine || isPostOwner}
              onEdit={() => {
                setEditing(item);
                setDraft(item.content);
              }}
              onDelete={() => setPendingDelete({ kind: "comment", comment: item })}
            />
          );
        }}
        ItemSeparatorComponent={() => <Separator />}
        ListEmptyComponent={
          comments.loading ? (
            <ActivityIndicator className="py-8" />
          ) : comments.error ? undefined : (
            <EmptyState
              icon="chatbubbles-outline"
              title="No comments yet"
              description={canComment ? "Start the conversation." : "Comments are turned off."}
            />
          )
        }
        ListFooterComponent={
          comments.loadingMore ? <ActivityIndicator className="py-4" /> : undefined
        }
        onEndReached={comments.loadMore}
        onEndReachedThreshold={0.4}
        keyboardShouldPersistTaps="handled"
      />

      {canComment ? (
        <View
          className="gap-2 border-t border-separator bg-background px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {editing ? (
            <View className="flex-row items-center gap-2">
              <Ionicons name="create-outline" size={14} color={muted} />
              <Typography.Paragraph type="body-xs" color="muted" className="flex-1">
                Editing your comment
              </Typography.Paragraph>
              <Button
                size="sm"
                variant="ghost"
                onPress={() => {
                  setEditing(null);
                  setDraft("");
                }}
              >
                Cancel
              </Button>
            </View>
          ) : null}
          <View className="flex-row items-end gap-2">
            <View className="flex-1">
              <Input
                value={draft}
                onChangeText={setDraft}
                placeholder={editing ? "Edit your comment" : "Write a comment…"}
                maxLength={2000}
                multiline
                className="max-h-32"
              />
            </View>
            <Button
              isIconOnly
              onPress={send}
              isDisabled={sending || !draft.trim()}
              accessibilityLabel={editing ? "Save comment" : "Send comment"}
            >
              <Ionicons name={editing ? "checkmark" : "send"} size={18} color={accentForeground} />
            </Button>
          </View>
        </View>
      ) : (
        <View
          className="items-center border-t border-separator px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <Typography.Paragraph type="body-sm" color="muted">
            Comments are turned off for this post.
          </Typography.Paragraph>
        </View>
      )}

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
        title={pendingDelete?.kind === "post" ? "Delete this post?" : "Delete this comment?"}
        description={
          pendingDelete?.kind === "post"
            ? "It will be removed along with its comments. This can't be undone."
            : "This comment will be removed for everyone."
        }
        isPending={deleting}
        onConfirm={confirmDelete}
      />
    </KeyboardAvoidingView>
  );
}
