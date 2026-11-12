import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  ControlField,
  Description,
  Dialog,
  Input,
  Label,
  Separator,
  TextField,
  Typography,
  useThemeColor,
  useToast,
} from "heroui-native";
import { useEffect, useState, type JSX } from "react";
import { ScrollView, View } from "react-native";
import { conversationApi } from "../../../../api/chat";
import type { Author, ConversationView, PublicUser } from "../../../../api/types";
import { ConfirmDialog } from "../../../../component/confirm-dialog";
import { EmptyState, LoadingView } from "../../../../component/state-views";
import { UserAvatar } from "../../../../component/user-avatar";
import { UserPicker } from "../../../../component/user-picker";
import { UserRow } from "../../../../component/user-row";
import { useAuth } from "../../../../context/auth-context";
import { useSocketEvent } from "../../../../context/realtime-context";
import { conversationAvatar, conversationTitle, otherParticipant } from "../../../../lib/chat";
import { openUser } from "../../../../lib/navigation";
import { errorMessage } from "../../../../services/api";

export default function ConversationInfoScreen(): JSX.Element {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { userId } = useAuth();
  const { toast } = useToast();
  const muted = useThemeColor("muted");

  const [conversation, setConversation] = useState<ConversationView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState<PublicUser[]>([]);
  const [removing, setRemoving] = useState<Author | null>(null);

  useEffect(() => {
    conversationApi
      .get(conversationId)
      .then(setConversation)
      .catch((error) => setLoadError(errorMessage(error, "This conversation isn't available")));
  }, [conversationId]);

  useSocketEvent("conversation:updated", (updated) => {
    if (updated._id === conversationId)
      setConversation((current) => (current ? { ...current, ...updated } : current));
  });

  if (loadError)
    return (
      <View className="flex-1 bg-background">
        <EmptyState icon="alert-circle-outline" title="Unavailable" description={loadError} />
      </View>
    );
  if (!conversation) return <LoadingView />;

  const isAdmin = conversation.role === "admin" || conversation.role === "owner";
  const other = conversation.isGroup ? undefined : otherParticipant(conversation, userId);

  async function save(
    request: () => Promise<{ data?: ConversationView | undefined }>,
    failure: string
  ): Promise<boolean> {
    setSaving(true);
    try {
      const { data } = await request();
      if (data) setConversation((current) => (current ? { ...current, ...data } : data));
      return true;
    } catch (error) {
      toast.show({ variant: "danger", label: failure, description: errorMessage(error) });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function toggleMute(value: boolean): Promise<void> {
    setSaving(true);
    try {
      const { data } = await conversationApi.mute(conversationId, value);
      setConversation((current) =>
        current ? { ...current, isMuted: data?.isMuted ?? value } : current
      );
    } catch (error) {
      toast.show({ variant: "danger", label: "Couldn't update", description: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function rename(): Promise<void> {
    const groupName = (name ?? "").trim();
    if (!groupName) return;
    if (
      await save(
        () => conversationApi.updateGroup(conversationId, { groupName }),
        "Couldn't rename"
      )
    )
      setName(null);
  }

  async function addMembers(): Promise<void> {
    const ids = toAdd.map((user) => user._id);
    if (!ids.length) return;
    if (
      await save(
        () => conversationApi.updateGroup(conversationId, { addMembers: ids }),
        "Couldn't add members"
      )
    ) {
      setAdding(false);
      setToAdd([]);
    }
  }

  async function removeMember(): Promise<void> {
    const member = removing;
    setRemoving(null);
    if (!member) return;
    await save(
      () => conversationApi.updateGroup(conversationId, { removeMembers: [member._id] }),
      "Couldn't remove member"
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 p-4 pb-10">
      <Stack.Screen options={{ title: conversation.isGroup ? "Group info" : "Chat info" }} />

      <Card className="items-center gap-2 py-6">
        <UserAvatar user={conversationAvatar(conversation, userId)} size="lg" />
        <Typography.Heading type="h4" align="center">
          {conversationTitle(conversation, userId)}
        </Typography.Heading>
        {conversation.isGroup ? (
          <Typography.Paragraph color="muted">
            {conversation.participants.length} members
          </Typography.Paragraph>
        ) : other ? (
          <Button size="sm" variant="secondary" onPress={() => openUser(other._id)}>
            View profile
          </Button>
        ) : null}
      </Card>

      <Card className="gap-4">
        <ControlField
          isSelected={conversation.isMuted}
          onSelectedChange={(value) => void toggleMute(value)}
          isDisabled={saving}
        >
          <View className="flex-1">
            <Label>Mute notifications</Label>
            <Description>Messages still arrive, without alerts.</Description>
          </View>
          <ControlField.Indicator />
        </ControlField>

        {conversation.isGroup && isAdmin ? (
          <>
            <Separator />
            {name === null ? (
              <Button variant="secondary" onPress={() => setName(conversation.groupName ?? "")}>
                Rename group
              </Button>
            ) : (
              <View className="gap-2">
                <TextField>
                  <Label>Group name</Label>
                  <Input value={name} onChangeText={setName} maxLength={50} autoFocus />
                </TextField>
                <View className="flex-row justify-end gap-2">
                  <Button size="sm" variant="ghost" onPress={() => setName(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" isDisabled={saving || !name.trim()} onPress={rename}>
                    Save
                  </Button>
                </View>
              </View>
            )}
          </>
        ) : null}
      </Card>

      {conversation.isGroup ? (
        <Card className="gap-1">
          <View className="flex-row items-center justify-between pb-1">
            <Card.Title>Members</Card.Title>
            {isAdmin ? (
              <Button size="sm" variant="ghost" onPress={() => setAdding(true)}>
                <Ionicons name="person-add-outline" size={16} color={muted} />
                Add
              </Button>
            ) : null}
          </View>
          {conversation.participants.map((member) => {
            const isOwner = member._id === conversation.createdBy;
            const isMemberAdmin = conversation.admins.includes(member._id);
            const isMe = member._id === userId;
            return (
              <UserRow
                key={member._id}
                user={member}
                isOnline={conversation.onlineParticipants.includes(member._id)}
                subtitle={`${isMe ? "You" : `@${member.username}`}${
                  isOwner ? " · Owner" : isMemberAdmin ? " · Admin" : ""
                }`}
                onPress={isMe ? undefined : () => openUser(member._id)}
                accessory={
                  isAdmin && !isMe && !isOwner ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      accessibilityLabel={`Remove ${member.username}`}
                      onPress={() => setRemoving(member)}
                    >
                      <Ionicons name="remove-circle-outline" size={20} color={muted} />
                    </Button>
                  ) : undefined
                }
              />
            );
          })}
        </Card>
      ) : null}

      <Button variant="ghost" onPress={() => router.back()}>
        Back to chat
      </Button>

      <ConfirmDialog
        isOpen={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove @${removing?.username ?? ""}?`}
        description="They'll leave the group and stop receiving its messages."
        confirmLabel="Remove"
        isPending={saving}
        onConfirm={removeMember}
      />

      <Dialog isOpen={adding} onOpenChange={(open) => !open && !saving && setAdding(false)}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="h-[80%] gap-3 px-0">
            <View className="px-4">
              <Dialog.Title>Add members</Dialog.Title>
            </View>
            <View className="flex-1">
              <UserPicker
                selected={toAdd}
                excludeIds={conversation.participants.map((member) => member._id)}
                onToggle={(user) =>
                  setToAdd((current) =>
                    current.some((item) => item._id === user._id)
                      ? current.filter((item) => item._id !== user._id)
                      : [...current, user]
                  )
                }
              />
            </View>
            <View className="flex-row justify-end gap-3 px-4">
              <Button
                variant="ghost"
                size="sm"
                onPress={() => {
                  setAdding(false);
                  setToAdd([]);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" isDisabled={saving || !toAdd.length} onPress={addMembers}>
                {toAdd.length ? `Add ${toAdd.length}` : "Add"}
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </ScrollView>
  );
}
