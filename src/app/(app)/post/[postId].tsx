import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Button,
  Input,
  Spinner,
  Typography,
  useThemeColor,
  useToast,
  type InputRef,
} from "heroui-native";
import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { commentApi, postApi } from "../../../api/posts";
import { authorId, type Author, type Comment, type Post } from "../../../api/types";
import { CommentRow } from "../../../component/comment-row";
import { ConfirmDialog } from "../../../component/confirm-dialog";
import { PostCard } from "../../../component/post-card";
import { ReportDialog, type ReportTarget } from "../../../component/report-dialog";
import { EmptyState, LoadingView } from "../../../component/state-views";
import { useAuth } from "../../../context/auth-context";
import { usePaginatedList } from "../../../hook/use-paginated-list";
import { displayName } from "../../../lib/format";
import { openUser } from "../../../lib/navigation";
import { emitPostEvent, usePostEvents } from "../../../lib/post-events";
import { schemas, validateForm } from "../../../lib/validation";
import { errorMessage } from "../../../services/api";

const REPLIES_PAGE = 10;

/** Replies loaded under one top-level comment. */
interface Thread {
  items: Comment[];
  /** Last page fetched (0 = none yet; items may still hold replies you just posted). */
  page: number;
  totalPages: number;
  open: boolean;
  loading: boolean;
}
const EMPTY_THREAD: Thread = { items: [], page: 0, totalPages: 1, open: false, loading: false };

type PendingDelete = { kind: "post" } | { kind: "comment"; comment: Comment };
/** What the composer is doing besides writing a new top-level comment. */
type Composer =
  | { mode: "edit"; comment: Comment }
  | { mode: "reply"; parentId: string; to: Author | null }
  | null;

const mergeById = (current: Comment[], incoming: Comment[]): Comment[] => {
  const seen = new Set(current.map((c) => c._id));
  return [...current, ...incoming.filter((c) => !seen.has(c._id))];
};

export default function PostDetailScreen(): JSX.Element {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { userId, profile } = useAuth();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const [accentForeground, muted] = useThemeColor(["accent-foreground", "muted"]);
  const inputRef = useRef<InputRef>(null);

  const [post, setPost] = useState<Post | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  const fetcher = useCallback(
    (page: number, size: number) => commentApi.list(postId, page, size),
    [postId]
  );
  const comments = usePaginatedList<Comment>(fetcher, 15);
  const { setItems: setComments } = comments;
  const [threads, setThreads] = useState<Record<string, Thread>>({});

  const [draft, setDraft] = useState("");
  const [composer, setComposer] = useState<Composer>(null);
  const [sending, setSending] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [report, setReport] = useState<ReportTarget | null>(null);

  useEffect(() => {
    postApi
      .get(postId)
      .then(setPost)
      .catch((error) => setPostError(errorMessage(error, "This post isn't available")));
  }, [postId]);

  // Edits from the editor modal, and like/save/share counters from the card itself.
  usePostEvents((event) => {
    if (event.type === "updated" && event.post._id === postId)
      setPost((current) =>
        current ? { ...current, ...event.post, author: current.author } : current
      );
  });

  const isPostOwner = !!post && authorId(post.author) === userId;

  const changeCommentCount = (delta: number) =>
    setPost((current) => {
      if (!current) return current;
      const commentsCount = Math.max(0, current.commentsCount + delta);
      emitPostEvent({ type: "updated", post: { _id: current._id, commentsCount } });
      return { ...current, commentsCount };
    });

  const patchThread = (parentId: string, update: (thread: Thread) => Thread) =>
    setThreads((all) => ({ ...all, [parentId]: update(all[parentId] ?? EMPTY_THREAD) }));

  const changeRepliesCount = (parentId: string, delta: number) =>
    setComments((items) =>
      items.map((item) =>
        item._id === parentId
          ? { ...item, repliesCount: Math.max(0, (item.repliesCount ?? 0) + delta) }
          : item
      )
    );

  async function loadReplies(parentId: string): Promise<void> {
    const thread = threads[parentId] ?? EMPTY_THREAD;
    if (thread.loading) return;
    const nextPage = thread.page + 1;
    patchThread(parentId, (t) => ({ ...t, open: true, loading: true }));
    try {
      const { data, meta } = await commentApi.replies(parentId, nextPage, REPLIES_PAGE);
      patchThread(parentId, (t) => ({
        ...t,
        items: mergeById(t.items, data ?? []),
        page: nextPage,
        totalPages: meta?.totalPages ?? nextPage,
        loading: false,
      }));
    } catch (error) {
      patchThread(parentId, (t) => ({ ...t, loading: false }));
      toast.show({
        variant: "danger",
        label: "Couldn't load replies",
        description: errorMessage(error),
      });
    }
  }

  function toggleThread(parent: Comment): void {
    const thread = threads[parent._id] ?? EMPTY_THREAD;
    if (thread.open) patchThread(parent._id, (t) => ({ ...t, open: false }));
    else if (thread.page === 0) void loadReplies(parent._id);
    else patchThread(parent._id, (t) => ({ ...t, open: true }));
  }

  function startReply(target: Comment): void {
    const parentId = target.parentComment ?? target._id;
    const to = typeof target.author === "string" ? null : target.author;
    setComposer({ mode: "reply", parentId, to });
    // Replying to a reply: mention who you're answering.
    setDraft(target.parentComment && to ? `@${to.username} ` : "");
    inputRef.current?.focus();
  }

  function startEdit(comment: Comment): void {
    setComposer({ mode: "edit", comment });
    setDraft(comment.content);
    inputRef.current?.focus();
  }

  function resetComposer(): void {
    setComposer(null);
    setDraft("");
  }

  const replaceComment = (updated: Comment) => {
    const merge = (item: Comment) =>
      item._id === updated._id ? { ...item, ...updated, author: item.author } : item;
    if (updated.parentComment) {
      patchThread(updated.parentComment, (t) => ({ ...t, items: t.items.map(merge) }));
    } else {
      setComments((items) => items.map(merge));
    }
  };

  async function send(): Promise<void> {
    const result = validateForm(schemas.comment, { content: draft });
    if (!result.success) {
      toast.show({ variant: "warning", label: result.errors.content ?? "Invalid comment" });
      return;
    }
    const content = result.data.content;
    setSending(true);
    try {
      if (composer?.mode === "edit") {
        replaceComment(await commentApi.update(composer.comment._id, content));
      } else if (composer?.mode === "reply") {
        const created = await commentApi.create(postId, content, composer.parentId);
        const parentId = created.parentComment ?? composer.parentId;
        patchThread(parentId, (t) => ({ ...t, open: true, items: mergeById(t.items, [created]) }));
        changeRepliesCount(parentId, 1);
        changeCommentCount(1);
      } else {
        const created = await commentApi.create(postId, content);
        setComments((items) => [created, ...items]);
        changeCommentCount(1);
      }
      resetComposer();
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
      const { data } = await commentApi.remove(comment._id);
      if (comment.parentComment) {
        const parentId = comment.parentComment;
        patchThread(parentId, (t) => ({
          ...t,
          items: t.items.filter((item) => item._id !== comment._id),
        }));
        changeRepliesCount(parentId, -1);
        changeCommentCount(-1);
      } else {
        setComments((items) => items.filter((item) => item._id !== comment._id));
        setThreads(({ [comment._id]: _removed, ...rest }) => rest);
        changeCommentCount(-(1 + (data?.removedReplies ?? comment.repliesCount ?? 0)));
      }
      if (composer?.mode === "edit" && composer.comment._id === comment._id) resetComposer();
      if (composer?.mode === "reply" && composer.parentId === comment._id) resetComposer();
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

  const renderComment = (item: Comment, isReply: boolean) => {
    const mine = authorId(item.author) === userId;
    return (
      <CommentRow
        key={item._id}
        comment={item}
        fallbackAuthor={profile}
        isReply={isReply}
        canEdit={mine}
        canDelete={mine || isPostOwner}
        onEdit={() => startEdit(item)}
        onDelete={() => setPendingDelete({ kind: "comment", comment: item })}
        onAuthorPress={() => openUser(authorId(item.author))}
        onReport={mine ? undefined : () => setReport({ type: "comment", id: item._id })}
        onReply={canComment ? () => startReply(item) : undefined}
      />
    );
  };

  const composerHint =
    composer?.mode === "edit"
      ? { icon: "create-outline" as const, text: "Editing your comment" }
      : composer?.mode === "reply"
        ? {
            icon: "return-down-forward-outline" as const,
            text: composer.to ? `Replying to ${displayName(composer.to)}` : "Replying",
          }
        : null;

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
          <View className="gap-4 pb-1 pt-3">
            <PostCard
              post={post}
              fallbackAuthor={profile}
              isOwner={isPostOwner}
              expanded
              onPress={() => inputRef.current?.focus()}
              onEdit={() => router.push({ pathname: "/post/editor", params: { postId } })}
              onDelete={() => setPendingDelete({ kind: "post" })}
              onAuthorPress={() => openUser(authorId(post.author))}
              onReport={() => setReport({ type: "post", id: post._id })}
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
          const thread = threads[item._id] ?? EMPTY_THREAD;
          const repliesCount = item.repliesCount ?? 0;
          const hiddenCount = Math.max(0, repliesCount - thread.items.length);
          const canLoadMore = thread.page < thread.totalPages && hiddenCount > 0;
          return (
            <View className="border-b border-separator">
              {renderComment(item, false)}
              {thread.open ? thread.items.map((reply) => renderComment(reply, true)) : null}
              {repliesCount > 0 && (!thread.open || canLoadMore || thread.loading) ? (
                <Pressable
                  onPress={() =>
                    thread.open && canLoadMore ? void loadReplies(item._id) : toggleThread(item)
                  }
                  disabled={thread.loading}
                  accessibilityRole="button"
                  className="flex-row items-center gap-2 pb-3 pl-11"
                >
                  <View className="h-px w-6 bg-separator" />
                  {thread.loading ? <Spinner size="sm" /> : null}
                  <Typography type="body-xs" weight="semibold" color="muted">
                    {thread.open
                      ? `View ${hiddenCount} more ${hiddenCount === 1 ? "reply" : "replies"}`
                      : `View ${repliesCount} ${repliesCount === 1 ? "reply" : "replies"}`}
                  </Typography>
                </Pressable>
              ) : null}
              {thread.open && repliesCount > 0 && !canLoadMore && !thread.loading ? (
                <Pressable
                  onPress={() => toggleThread(item)}
                  accessibilityRole="button"
                  className="flex-row items-center gap-2 pb-3 pl-11"
                >
                  <View className="h-px w-6 bg-separator" />
                  <Typography type="body-xs" weight="semibold" color="muted">
                    Hide replies
                  </Typography>
                </Pressable>
              ) : null}
            </View>
          );
        }}
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
          {composerHint ? (
            <View className="flex-row items-center gap-2">
              <Ionicons name={composerHint.icon} size={14} color={muted} />
              <Typography.Paragraph type="body-xs" color="muted" className="flex-1">
                {composerHint.text}
              </Typography.Paragraph>
              <Button size="sm" variant="ghost" onPress={resetComposer}>
                Cancel
              </Button>
            </View>
          ) : null}
          <View className="flex-row items-end gap-2">
            <View className="flex-1">
              <Input
                ref={inputRef}
                value={draft}
                onChangeText={setDraft}
                placeholder={
                  composer?.mode === "edit"
                    ? "Edit your comment"
                    : composer?.mode === "reply"
                      ? "Write a reply…"
                      : "Write a comment…"
                }
                maxLength={2000}
                multiline
                className="max-h-32"
              />
            </View>
            <Button
              isIconOnly
              onPress={send}
              isDisabled={sending || !draft.trim()}
              accessibilityLabel={composer?.mode === "edit" ? "Save comment" : "Send comment"}
              className="rounded-full"
            >
              <Ionicons
                name={composer?.mode === "edit" ? "checkmark" : "send"}
                size={18}
                color={accentForeground}
              />
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
            : pendingDelete?.comment.repliesCount
              ? "This comment and its replies will be removed for everyone."
              : "This comment will be removed for everyone."
        }
        isPending={deleting}
        onConfirm={confirmDelete}
      />
      <ReportDialog target={report} onClose={() => setReport(null)} />
    </KeyboardAvoidingView>
  );
}
