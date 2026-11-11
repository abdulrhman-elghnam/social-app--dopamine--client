import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, Button, Typography, useThemeColor, useToast } from "heroui-native";
import { useCallback, useState, type JSX } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { postApi } from "../../../api/posts";
import type { Post } from "../../../api/types";
import { ConfirmDialog } from "../../../component/confirm-dialog";
import { PostCard } from "../../../component/post-card";
import { EmptyState, LoadingView } from "../../../component/state-views";
import { useAuth } from "../../../context/auth-context";
import { usePaginatedList } from "../../../hook/use-paginated-list";
import { usePostEvents } from "../../../lib/post-events";
import { errorMessage } from "../../../services/api";

export default function PostsScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { profile, userId } = useAuth();
  const accentForeground = useThemeColor("accent-foreground");
  const fetcher = useCallback((page: number, size: number) => postApi.feed(page, size), []);
  const list = usePaginatedList<Post>(fetcher);
  const { setItems } = list;

  const [pendingDelete, setPendingDelete] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);

  usePostEvents((event) => {
    if (event.type === "created") setItems((items) => [event.post, ...items]);
    if (event.type === "updated")
      setItems((items) =>
        items.map((item) =>
          item._id === event.post._id
            ? // keep the populated author; update responses only carry the author id
              { ...item, ...event.post, author: item.author }
            : item
        )
      );
    if (event.type === "deleted")
      setItems((items) => items.filter((item) => item._id !== event.postId));
  });

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await postApi.remove(pendingDelete._id);
      setItems((items) => items.filter((item) => item._id !== pendingDelete._id));
      toast.show({ variant: "success", label: "Post deleted" });
      setPendingDelete(null);
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Couldn't delete post",
        description: errorMessage(error),
      });
    } finally {
      setDeleting(false);
    }
  }

  const compose = () => router.push("/post/editor");

  if (list.loading) return <LoadingView />;

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={list.items}
        keyExtractor={(post) => post._id}
        contentContainerClassName="gap-3 px-4"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 96 }}
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <View className="flex-row items-center justify-between">
              <View>
                <Typography.Heading type="h3">My posts</Typography.Heading>
                <Typography.Paragraph type="body-sm" color="muted">
                  {profile ? `Signed in as @${profile.username}` : " "}
                </Typography.Paragraph>
              </View>
            </View>
            {list.error ? (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Couldn’t load posts</Alert.Title>
                  <Alert.Description>{list.error}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            fallbackAuthor={profile}
            isOwner={(typeof item.author === "string" ? item.author : item.author._id) === userId}
            onPress={() =>
              router.push({ pathname: "/post/[postId]", params: { postId: item._id } })
            }
            onEdit={() => router.push({ pathname: "/post/editor", params: { postId: item._id } })}
            onDelete={() => setPendingDelete(item)}
          />
        )}
        ListEmptyComponent={
          list.error ? undefined : (
            <EmptyState
              icon="sparkles-outline"
              title="Nothing here yet"
              description="Share your first thought — it'll show up here."
              actionLabel="Write a post"
              onAction={compose}
            />
          )
        }
        ListFooterComponent={list.loadingMore ? <ActivityIndicator className="py-4" /> : undefined}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
      />

      <View className="absolute bottom-6 right-5">
        <Button
          isIconOnly
          size="lg"
          onPress={compose}
          accessibilityLabel="New post"
          className="rounded-full"
        >
          <Ionicons name="add" size={26} color={accentForeground} />
        </Button>
      </View>

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
        title="Delete this post?"
        description="It will be removed along with its comments. This can't be undone."
        isPending={deleting}
        onConfirm={confirmDelete}
      />
    </View>
  );
}
