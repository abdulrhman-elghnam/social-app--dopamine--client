import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { Button, Separator, Typography, useThemeColor, useToast } from "heroui-native";
import { useCallback, type ComponentProps, type JSX } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from "react-native";
import { notificationApi } from "../../api/social";
import { refId, type AppNotification, type NotificationType } from "../../api/types";
import { EmptyState, LoadingView } from "../../component/state-views";
import { UserAvatar } from "../../component/user-avatar";
import { useRealtime, useSocketEvent } from "../../context/realtime-context";
import { usePaginatedList } from "../../hook/use-paginated-list";
import { displayName, timeAgo } from "../../lib/format";
import { openPost, openUser } from "../../lib/navigation";
import { errorMessage } from "../../services/api";

const COPY: Record<
  NotificationType,
  { text: string; icon: ComponentProps<typeof Ionicons>["name"] }
> = {
  follow: { text: "started following you", icon: "person-add" },
  follow_request: { text: "requested to follow you", icon: "person-add-outline" },
  follow_accepted: { text: "accepted your follow request", icon: "checkmark-circle" },
  like: { text: "liked your post", icon: "heart" },
  comment: { text: "commented on your post", icon: "chatbubble" },
  reply: { text: "replied to your comment", icon: "return-down-forward" },
  comment_like: { text: "liked your comment", icon: "heart-outline" },
  share: { text: "shared your post", icon: "repeat" },
};

export default function NotificationsScreen(): JSX.Element {
  const { toast } = useToast();
  const [accent, muted] = useThemeColor(["accent", "muted"]);
  const { unreadNotifications, setUnreadNotifications } = useRealtime();
  const fetcher = useCallback((page: number, size: number) => notificationApi.list(page, size), []);
  const list = usePaginatedList<AppNotification>(fetcher, 20);
  const { setItems } = list;

  useSocketEvent("notification:new", ({ notification }) =>
    setItems((items) =>
      items.some((item) => item._id === notification._id) ? items : [notification, ...items]
    )
  );
  useSocketEvent("notification:read:update", (update) =>
    setItems((items) =>
      items.map((item) =>
        "all" in update || item._id === update.notificationId ? { ...item, isRead: true } : item
      )
    )
  );

  function open(item: AppNotification): void {
    if (!item.isRead) {
      setItems((items) => items.map((n) => (n._id === item._id ? { ...n, isRead: true } : n)));
      notificationApi
        .markRead(item._id)
        .then((response) => setUnreadNotifications(response.data?.unreadCount ?? 0))
        .catch(() => undefined);
    }
    if (item.type === "follow_request") router.push("/follow-requests");
    else if (item.post) openPost(item.post);
    else openUser(refId(item.sender));
  }

  async function markAllRead(): Promise<void> {
    try {
      await notificationApi.markAllRead();
      setItems((items) => items.map((item) => ({ ...item, isRead: true })));
      setUnreadNotifications(0);
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Couldn't mark as read",
        description: errorMessage(error),
      });
    }
  }

  async function remove(item: AppNotification): Promise<void> {
    setItems((items) => items.filter((n) => n._id !== item._id));
    try {
      await notificationApi.remove(item._id);
      if (!item.isRead) setUnreadNotifications(Math.max(0, unreadNotifications - 1));
    } catch (error) {
      setItems((items) => [item, ...items]);
      toast.show({ variant: "danger", label: "Couldn't delete", description: errorMessage(error) });
    }
  }

  if (list.loading) return <LoadingView />;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: "Notifications",
          headerRight: () =>
            unreadNotifications > 0 ? (
              <Button size="sm" variant="ghost" onPress={markAllRead}>
                Mark all read
              </Button>
            ) : null,
        }}
      />
      <FlatList
        data={list.items}
        keyExtractor={(item) => item._id}
        contentContainerClassName="pb-10"
        ListHeaderComponent={
          <View>
            <Pressable
              onPress={() => router.push("/follow-requests")}
              className="flex-row items-center gap-3 px-4 py-3.5"
              accessibilityRole="button"
            >
              <Ionicons name="people-outline" size={22} color={muted} />
              <Typography className="flex-1" weight="medium">
                Follow requests
              </Typography>
              <Ionicons name="chevron-forward" size={18} color={muted} />
            </Pressable>
            <Separator />
            {list.error ? (
              <Typography.Paragraph type="body-sm" className="px-4 py-2 text-danger">
                {list.error}
              </Typography.Paragraph>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const sender = typeof item.sender === "string" ? null : item.sender;
          const copy = COPY[item.type];
          return (
            <Pressable
              onPress={() => open(item)}
              className={`flex-row items-center gap-3 px-4 py-3 ${item.isRead ? "" : "bg-accent/5"}`}
              accessibilityRole="button"
            >
              <View>
                {sender ? <UserAvatar user={sender} /> : null}
                <View className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5">
                  <Ionicons name={copy.icon} size={14} color={accent} />
                </View>
              </View>
              <View className="flex-1">
                <Typography.Paragraph type="body-sm" numberOfLines={2}>
                  <Typography.Paragraph type="body-sm" weight="semibold">
                    {sender ? displayName(sender) : "Someone"}
                  </Typography.Paragraph>{" "}
                  {copy.text}
                </Typography.Paragraph>
                <Typography.Paragraph type="body-xs" color="muted">
                  {timeAgo(item.createdAt)}
                </Typography.Paragraph>
              </View>
              {item.isRead ? null : <View className="size-2 rounded-full bg-accent" />}
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                onPress={() => void remove(item)}
                accessibilityLabel="Delete notification"
              >
                <Ionicons name="close" size={16} color={muted} />
              </Button>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <Separator />}
        ListEmptyComponent={
          list.error ? undefined : (
            <EmptyState
              icon="notifications-outline"
              title="You're all caught up"
              description="Likes, comments and new followers will show up here."
            />
          )
        }
        ListFooterComponent={list.loadingMore ? <ActivityIndicator className="py-4" /> : undefined}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
      />
    </View>
  );
}
