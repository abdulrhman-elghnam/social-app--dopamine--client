import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Button, Separator, Typography, useThemeColor } from "heroui-native";
import { useCallback, type JSX } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { conversationApi } from "../../../api/chat";
import type { ConversationView } from "../../../api/types";
import { EmptyState, LoadingView } from "../../../component/state-views";
import { UserAvatar } from "../../../component/user-avatar";
import { useAuth } from "../../../context/auth-context";
import { useRealtime, useSocketEvent } from "../../../context/realtime-context";
import { usePaginatedList } from "../../../hook/use-paginated-list";
import {
  conversationAvatar,
  conversationTitle,
  messagePreview,
  otherParticipant,
  toPreview,
} from "../../../lib/chat";
import { timeAgo } from "../../../lib/format";
import { openConversation } from "../../../lib/navigation";

const lastActivity = (conversation: ConversationView) =>
  conversation.lastMessage?.createdAt ?? conversation.updatedAt;

export default function ChatsScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const { chatUnread } = useRealtime();
  const [muted, accentForeground] = useThemeColor(["muted", "accent-foreground"]);
  const fetcher = useCallback((page: number, size: number) => conversationApi.list(page, size), []);
  const list = usePaginatedList<ConversationView>(fetcher, 20);
  const { setItems, refresh, items } = list;

  useSocketEvent("message:new", (message) => {
    // A conversation we don't have yet (a new chat someone else started): reload the list.
    if (!items.some((conversation) => conversation._id === message.conversation)) {
      void refresh();
      return;
    }
    setItems((current) => {
      const updated = current.map((conversation) =>
        conversation._id === message.conversation
          ? { ...conversation, lastMessage: toPreview(message), updatedAt: message.createdAt }
          : conversation
      );
      return updated.sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
    });
  });

  useSocketEvent("conversation:updated", (conversation) => {
    const removed = !conversation.participants.some((participant) => participant._id === userId);
    setItems((current) =>
      removed
        ? current.filter((item) => item._id !== conversation._id)
        : current.map((item) =>
            item._id === conversation._id ? { ...item, ...conversation } : item
          )
    );
  });

  useSocketEvent("message:deleted", ({ conversationId, messageId }) =>
    setItems((current) =>
      current.map((item) =>
        item._id === conversationId && item.lastMessage?._id === messageId
          ? { ...item, lastMessage: { ...item.lastMessage, deletedAt: new Date().toISOString() } }
          : item
      )
    )
  );

  const onPresence = ({ userId: who, isOnline }: { userId: string; isOnline: boolean }) =>
    setItems((current) =>
      current.map((item) =>
        item.participants.some((participant) => participant._id === who)
          ? {
              ...item,
              onlineParticipants: isOnline
                ? [...new Set([...item.onlineParticipants, who])]
                : item.onlineParticipants.filter((id) => id !== who),
            }
          : item
      )
    );
  useSocketEvent("presence:online", onPresence);
  useSocketEvent("presence:offline", onPresence);
  useSocketEvent("presence:update", onPresence);

  const startChat = () => router.push("/chat/new");

  if (list.loading) return <LoadingView />;

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={list.items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 96 }}
        ListHeaderComponent={
          <View className="gap-2 px-4 pb-2">
            <Typography.Heading type="h3">Chats</Typography.Heading>
            {list.error ? (
              <Typography.Paragraph type="body-sm" className="text-danger">
                {list.error}
              </Typography.Paragraph>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const unread = chatUnread[item._id] ?? 0;
          const other = item.isGroup ? undefined : otherParticipant(item, userId);
          const online = !!other && item.onlineParticipants.includes(other._id);
          return (
            <Pressable
              onPress={() => openConversation(item._id)}
              className="flex-row items-center gap-3 px-4 py-3"
              accessibilityRole="button"
            >
              <View>
                <UserAvatar user={conversationAvatar(item, userId)} />
                {online ? (
                  <View className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-background bg-success" />
                ) : null}
              </View>
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-1.5">
                  <Typography weight={unread ? "bold" : "semibold"} truncate className="flex-1">
                    {conversationTitle(item, userId)}
                  </Typography>
                  {item.isMuted ? (
                    <Ionicons name="notifications-off-outline" size={14} color={muted} />
                  ) : null}
                  <Typography.Paragraph type="body-xs" color="muted">
                    {timeAgo(lastActivity(item))}
                  </Typography.Paragraph>
                </View>
                <View className="flex-row items-center gap-2">
                  <Typography.Paragraph
                    type="body-sm"
                    color={unread ? "default" : "muted"}
                    numberOfLines={1}
                    className="flex-1"
                  >
                    {messagePreview(item.lastMessage, userId)}
                  </Typography.Paragraph>
                  {unread ? (
                    <View className="min-w-5 items-center rounded-full bg-accent px-1.5 py-0.5">
                      <Typography type="body-xs" weight="bold" className="text-accent-foreground">
                        {unread > 99 ? "99+" : unread}
                      </Typography>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <Separator className="ml-16" />}
        ListEmptyComponent={
          list.error ? undefined : (
            <EmptyState
              icon="chatbubbles-outline"
              title="No conversations yet"
              description="Message someone from their profile, or start a group."
              actionLabel="New chat"
              onAction={startChat}
            />
          )
        }
        ListFooterComponent={list.loadingMore ? <ActivityIndicator className="py-4" /> : undefined}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={refresh} />}
      />

      <View className="absolute bottom-6 right-5">
        <Button
          isIconOnly
          size="lg"
          onPress={startChat}
          accessibilityLabel="New chat"
          className="rounded-full"
        >
          <Ionicons name="create-outline" size={24} color={accentForeground} />
        </Button>
      </View>
    </View>
  );
}
