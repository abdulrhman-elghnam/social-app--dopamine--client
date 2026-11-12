import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Button, Input, Typography, useThemeColor, useToast } from "heroui-native";
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
import { conversationApi } from "../../../../api/chat";
import { refId, type Author, type ConversationView, type Message } from "../../../../api/types";
import { ConfirmDialog } from "../../../../component/confirm-dialog";
import { EmptyState, LoadingView } from "../../../../component/state-views";
import { UserAvatar } from "../../../../component/user-avatar";
import { useAuth } from "../../../../context/auth-context";
import { useRealtime, useSocketEvent } from "../../../../context/realtime-context";
import { usePaginatedList } from "../../../../hook/use-paginated-list";
import { conversationTitle, newClientId, otherParticipant } from "../../../../lib/chat";
import { displayName, timeAgo } from "../../../../lib/format";
import { openUser } from "../../../../lib/navigation";
import { errorMessage } from "../../../../services/api";

/** A message as the thread renders it; optimistic ones carry `clientId` + `pending`/`failed`. */
type ChatMessage = Message & { clientId?: string; pending?: boolean; failed?: boolean };

const MAX_LENGTH = 5000;
const TYPING_IDLE_MS = 2500;
/** Drop a typing indicator if its "stop" never arrives (e.g. the other client went offline). */
const TYPING_STALE_MS = 6000;

export default function ConversationScreen(): JSX.Element {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { userId, profile } = useAuth();
  const { connected, call, setActiveConversation, setConversationUnread } = useRealtime();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const [muted, accentForeground] = useThemeColor(["muted", "accent-foreground"]);

  const [conversation, setConversation] = useState<ConversationView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ChatMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const typingSent = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const fetcher = useCallback(
    (page: number, size: number) => conversationApi.messages(conversationId, page, size),
    [conversationId]
  );
  const list = usePaginatedList<ChatMessage>(fetcher, 30);
  const { setItems } = list;

  useEffect(() => {
    conversationApi
      .get(conversationId)
      .then(setConversation)
      .catch((error) => setLoadError(errorMessage(error, "This conversation isn't available")));
  }, [conversationId]);

  // While on screen: incoming messages here don't count as unread.
  useEffect(() => {
    setActiveConversation(conversationId);
    setConversationUnread(conversationId, 0);
    conversationApi.markRead(conversationId).catch(() => undefined);
    return () => setActiveConversation(null);
  }, [conversationId, setActiveConversation, setConversationUnread]);

  // Join the room for typing/read events; re-join after reconnects.
  useEffect(() => {
    if (!connected) return;
    call("conversation:join", { conversationId }).catch(() => undefined);
    return () => {
      call("conversation:leave", { conversationId }).catch(() => undefined);
    };
  }, [connected, conversationId, call]);

  // Stop typing + clear timers on leave.
  useEffect(() => {
    const timers = staleTimers.current;
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  // ── socket events ────────────────────────────────────────────────────────────

  function clearTyping(who: string): void {
    const timer = staleTimers.current.get(who);
    if (timer) clearTimeout(timer);
    staleTimers.current.delete(who);
    setTypingUsers((users) => users.filter((id) => id !== who));
  }

  useSocketEvent("message:new", (message) => {
    if (message.conversation !== conversationId) return;
    setItems((items) => {
      if (message.clientId && items.some((item) => item.clientId === message.clientId))
        return items.map((item) => (item.clientId === message.clientId ? message : item));
      if (items.some((item) => item._id === message._id)) return items;
      return [message, ...items];
    });
    if (refId(message.sender) !== userId) {
      clearTyping(refId(message.sender));
      call("message:read", { conversationId, messageId: message._id }).catch(() => undefined);
    }
  });

  useSocketEvent("message:edited", ({ conversationId: id, messageId, content, editedAt }) => {
    if (id !== conversationId) return;
    setItems((items) =>
      items.map((item) =>
        item._id === messageId
          ? {
              ...item,
              ...(content !== undefined ? { content } : {}),
              ...(editedAt ? { editedAt } : {}),
            }
          : item
      )
    );
  });

  useSocketEvent("message:deleted", ({ conversationId: id, messageId }) => {
    if (id !== conversationId) return;
    setItems((items) =>
      items.map((item) => {
        if (item._id !== messageId) return item;
        const { content: _content, ...rest } = item;
        return { ...rest, deletedAt: new Date().toISOString() };
      })
    );
  });

  useSocketEvent("message:delivered", ({ conversationId: id, messageId, deliveredTo }) => {
    if (id !== conversationId) return;
    setItems((items) =>
      items.map((item) => (item._id === messageId ? { ...item, deliveredTo } : item))
    );
  });

  useSocketEvent("message:read:update", ({ conversationId: id, userId: reader, readAt }) => {
    if (id !== conversationId || reader === userId) return;
    // Everything sent before the read time has been seen by `reader`.
    setItems((items) =>
      items.map((item) =>
        item.createdAt <= readAt && !item.readBy.includes(reader)
          ? { ...item, readBy: [...item.readBy, reader] }
          : item
      )
    );
  });

  useSocketEvent("typing:update", ({ conversationId: id, userId: who, isTyping }) => {
    if (id !== conversationId || who === userId) return;
    if (!isTyping) {
      clearTyping(who);
      return;
    }
    setTypingUsers((users) => (users.includes(who) ? users : [...users, who]));
    const timers = staleTimers.current;
    const previous = timers.get(who);
    if (previous) clearTimeout(previous);
    timers.set(
      who,
      setTimeout(() => clearTyping(who), TYPING_STALE_MS)
    );
  });

  useSocketEvent("conversation:updated", (updated) => {
    if (updated._id !== conversationId) return;
    if (!updated.participants.some((participant) => participant._id === userId)) {
      toast.show({ variant: "warning", label: "You're no longer in this group" });
      router.back();
      return;
    }
    setConversation((current) => (current ? { ...current, ...updated } : current));
  });

  const onPresence = ({ userId: who, isOnline }: { userId: string; isOnline: boolean }) =>
    setConversation((current) =>
      current && current.participants.some((participant) => participant._id === who)
        ? {
            ...current,
            onlineParticipants: isOnline
              ? [...new Set([...current.onlineParticipants, who])]
              : current.onlineParticipants.filter((id) => id !== who),
          }
        : current
    );
  useSocketEvent("presence:online", onPresence);
  useSocketEvent("presence:offline", onPresence);
  useSocketEvent("presence:update", onPresence);

  // ── typing ───────────────────────────────────────────────────────────────────

  function stopTyping(): void {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = null;
    if (typingSent.current) {
      typingSent.current = false;
      call("typing:stop", { conversationId }).catch(() => undefined);
    }
  }

  function onChangeDraft(text: string): void {
    setDraft(text);
    if (editing) return;
    if (!text) {
      stopTyping();
      return;
    }
    if (!typingSent.current) {
      typingSent.current = true;
      call("typing:start", { conversationId }).catch(() => undefined);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  }

  // ── actions ──────────────────────────────────────────────────────────────────

  async function deliver(message: ChatMessage): Promise<void> {
    try {
      const saved = await call("message:send", {
        conversationId,
        content: message.content ?? "",
        clientId: message.clientId ?? "",
      });
      if (saved)
        setItems((items) =>
          items.map((item) => (item.clientId === message.clientId ? saved : item))
        );
    } catch (error) {
      setItems((items) =>
        items.map((item) =>
          item.clientId === message.clientId ? { ...item, pending: false, failed: true } : item
        )
      );
      toast.show({
        variant: "danger",
        label: "Message not sent",
        description: errorMessage(error),
      });
    }
  }

  async function send(): Promise<void> {
    const content = draft.trim();
    if (!content) return;

    if (editing) {
      const target = editing;
      try {
        await call("message:edit", { messageId: target._id, content });
        setItems((items) =>
          items.map((item) =>
            item._id === target._id
              ? { ...item, content, editedAt: new Date().toISOString() }
              : item
          )
        );
        setEditing(null);
        setDraft("");
      } catch (error) {
        toast.show({ variant: "danger", label: "Couldn't edit", description: errorMessage(error) });
      }
      return;
    }

    stopTyping();
    setDraft("");
    const clientId = newClientId();
    const now = new Date().toISOString();
    const optimistic: ChatMessage = {
      _id: clientId,
      clientId,
      pending: true,
      conversation: conversationId,
      sender: profile ?? userId ?? "",
      content,
      media: [],
      type: "text",
      readBy: [],
      deliveredTo: [],
      createdAt: now,
      updatedAt: now,
    };
    setItems((items) => [optimistic, ...items]);
    await deliver(optimistic);
  }

  function retry(message: ChatMessage): void {
    setItems((items) =>
      items.map((item) =>
        item.clientId === message.clientId ? { ...item, pending: true, failed: false } : item
      )
    );
    void deliver(message);
  }

  async function remove(): Promise<void> {
    const target = confirmDelete;
    setConfirmDelete(null);
    if (!target) return;
    if (target.failed) {
      setItems((items) => items.filter((item) => item._id !== target._id));
      return;
    }
    try {
      await call("message:delete", { messageId: target._id });
    } catch (error) {
      toast.show({ variant: "danger", label: "Couldn't delete", description: errorMessage(error) });
    }
  }

  // ── render ───────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState
          icon="chatbubble-ellipses-outline"
          title="Conversation unavailable"
          description={loadError}
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }
  if (!conversation || list.loading) return <LoadingView />;

  const other = conversation.isGroup ? undefined : otherParticipant(conversation, userId);
  const membersById = new Map<string, Author>(
    conversation.participants.map((participant) => [participant._id, participant])
  );
  const typingNames = typingUsers
    .map((id) => membersById.get(id))
    .filter((member): member is Author => !!member)
    .map((member) => member.firstName || member.username);
  const subtitle = typingNames.length
    ? conversation.isGroup
      ? `${typingNames.join(", ")} typing…`
      : "typing…"
    : conversation.isGroup
      ? `${conversation.participants.length} members`
      : other && conversation.onlineParticipants.includes(other._id)
        ? "Online"
        : undefined;

  const othersCount = conversation.participants.length - 1;
  const newestMineIndex = list.items.findIndex(
    (item) => refId(item.sender) === userId && !item.deletedAt
  );

  function receipt(message: ChatMessage): string {
    if (message.failed) return "Not sent · tap to retry";
    if (message.pending) return "Sending…";
    const seen = message.readBy.filter((id) => id !== userId).length;
    if (seen) return conversation?.isGroup ? `Seen by ${seen}/${othersCount}` : "Seen";
    if (message.deliveredTo.some((id) => id !== userId)) return "Delivered";
    return "Sent";
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Pressable
              onPress={other ? () => openUser(other._id) : undefined}
              className="items-center"
              accessibilityRole="button"
            >
              <Typography weight="semibold" truncate>
                {conversationTitle(conversation, userId)}
              </Typography>
              {subtitle ? (
                <Typography.Paragraph type="body-xs" color="muted">
                  {subtitle}
                </Typography.Paragraph>
              ) : null}
            </Pressable>
          ),
          headerRight: () => (
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              accessibilityLabel="Conversation info"
              onPress={() =>
                router.push({ pathname: "/chat/[conversationId]/info", params: { conversationId } })
              }
            >
              <Ionicons name="information-circle-outline" size={22} color={muted} />
            </Button>
          ),
        }}
      />

      <FlatList
        inverted
        data={list.items}
        keyExtractor={(item) => item._id}
        contentContainerClassName="gap-1 px-3 py-3"
        renderItem={({ item, index }) => {
          const senderId = refId(item.sender);
          const mine = senderId === userId;
          const sender = typeof item.sender === "string" ? membersById.get(senderId) : item.sender;
          // Inverted list: the next item is the older one; group consecutive messages per sender.
          const older = list.items[index + 1];
          const firstOfRun = !older || refId(older.sender) !== senderId;
          const isSelected = selected?._id === item._id;
          return (
            <View className={`${mine ? "items-end" : "items-start"} ${firstOfRun ? "mt-2" : ""}`}>
              {conversation.isGroup && !mine && firstOfRun && sender ? (
                <Typography.Paragraph type="body-xs" color="muted" className="mb-0.5 ml-10">
                  {displayName(sender)}
                </Typography.Paragraph>
              ) : null}
              <View className="max-w-[80%] flex-row items-end gap-2">
                {conversation.isGroup && !mine ? (
                  <View className="w-8">
                    {firstOfRun && sender ? <UserAvatar user={sender} size="sm" /> : null}
                  </View>
                ) : null}
                <Pressable
                  onPress={item.failed ? () => retry(item) : () => setSelected(null)}
                  onLongPress={
                    mine && !item.deletedAt && !item.pending ? () => setSelected(item) : undefined
                  }
                  className={`rounded-2xl px-3.5 py-2 ${
                    item.deletedAt
                      ? "border border-separator"
                      : mine
                        ? "bg-accent"
                        : "bg-surface-secondary"
                  } ${isSelected ? "opacity-70" : ""} ${item.pending ? "opacity-60" : ""}`}
                >
                  {item.deletedAt ? (
                    <Typography.Paragraph type="body-sm" color="muted" className="italic">
                      Message deleted
                    </Typography.Paragraph>
                  ) : (
                    <Typography.Paragraph
                      type="body-sm"
                      className={mine ? "text-accent-foreground" : undefined}
                    >
                      {item.content}
                    </Typography.Paragraph>
                  )}
                </Pressable>
              </View>
              {index === newestMineIndex || item.failed ? (
                <Typography.Paragraph
                  type="body-xs"
                  color="muted"
                  className={`mt-0.5 px-1 ${item.failed ? "text-danger" : ""}`}
                >
                  {receipt(item)}
                  {item.editedAt && !item.deletedAt ? " · edited" : ""}
                </Typography.Paragraph>
              ) : item.editedAt && !item.deletedAt ? (
                <Typography.Paragraph type="body-xs" color="muted" className="mt-0.5 px-1">
                  edited
                </Typography.Paragraph>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          // Inverted lists render the empty component upside down.
          <View style={{ transform: [{ scaleY: -1 }] }}>
            <EmptyState
              icon="hand-left-outline"
              title="Say hello"
              description={
                conversation.isGroup
                  ? "Send the first message to the group."
                  : `This is the start of your chat${other ? ` with ${displayName(other)}` : ""}.`
              }
            />
          </View>
        }
        ListFooterComponent={list.loadingMore ? <ActivityIndicator className="py-4" /> : undefined}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.3}
        keyboardShouldPersistTaps="handled"
      />

      <View
        className="gap-2 border-t border-separator bg-background px-3 pt-2"
        style={{ paddingBottom: insets.bottom + 8 }}
      >
        {selected ? (
          <View className="flex-row items-center gap-2">
            <Typography.Paragraph type="body-xs" color="muted" className="flex-1">
              Sent {timeAgo(selected.createdAt)}
            </Typography.Paragraph>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setEditing(selected);
                setDraft(selected.content ?? "");
                setSelected(null);
              }}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="danger-soft"
              onPress={() => {
                setConfirmDelete(selected);
                setSelected(null);
              }}
            >
              Delete
            </Button>
            <Button size="sm" variant="ghost" onPress={() => setSelected(null)}>
              Cancel
            </Button>
          </View>
        ) : null}
        {editing ? (
          <View className="flex-row items-center gap-2">
            <Ionicons name="create-outline" size={14} color={muted} />
            <Typography.Paragraph type="body-xs" color="muted" className="flex-1">
              Editing message
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
        {!connected ? (
          <Typography.Paragraph type="body-xs" color="muted">
            Connecting…
          </Typography.Paragraph>
        ) : null}
        <View className="flex-row items-end gap-2">
          <View className="flex-1">
            <Input
              value={draft}
              onChangeText={onChangeDraft}
              placeholder={editing ? "Edit message" : "Message"}
              maxLength={MAX_LENGTH}
              multiline
              className="max-h-32"
            />
          </View>
          <Button
            isIconOnly
            onPress={send}
            isDisabled={!draft.trim() || !connected}
            accessibilityLabel={editing ? "Save message" : "Send message"}
          >
            <Ionicons name={editing ? "checkmark" : "send"} size={18} color={accentForeground} />
          </Button>
        </View>
      </View>

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Delete message?"
        description="It will be removed for everyone in this conversation."
        onConfirm={remove}
      />
    </KeyboardAvoidingView>
  );
}
