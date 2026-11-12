import { router, Stack } from "expo-router";
import { Button, Chip, FieldError, Input, Label, TextField, useToast } from "heroui-native";
import { useState, type JSX } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { conversationApi } from "../../../api/chat";
import type { PublicUser } from "../../../api/types";
import { UserPicker } from "../../../component/user-picker";
import { fieldError, fields } from "../../../lib/validation";
import { errorMessage } from "../../../services/api";

const GROUP_NAME_MAX = 50;

/** Pick one person for a direct chat, or several plus a name for a group. */
export default function NewChatScreen(): JSX.Element {
  const { toast } = useToast();
  const [selected, setSelected] = useState<PublicUser[]>([]);
  const [groupName, setGroupName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);

  const isGroup = selected.length > 1;

  function toggle(user: PublicUser): void {
    setSelected((current) =>
      current.some((item) => item._id === user._id)
        ? current.filter((item) => item._id !== user._id)
        : [...current, user]
    );
  }

  async function create(): Promise<void> {
    const [first] = selected;
    if (!first) return;
    const groupNameError = isGroup ? fieldError(fields.groupName, groupName) : undefined;
    if (groupNameError) {
      setNameError(groupNameError);
      return;
    }
    setCreating(true);
    try {
      const conversation = await conversationApi.create(
        isGroup
          ? {
              isGroup: true,
              participantIds: selected.map((user) => user._id),
              groupName: groupName.trim(),
            }
          : { participantIds: [first._id] }
      );
      router.replace({
        pathname: "/chat/[conversationId]",
        params: { conversationId: conversation._id },
      });
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Couldn't start chat",
        description: errorMessage(error),
      });
      setCreating(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: isGroup ? "New group" : "New chat",
          headerRight: () => (
            <Button size="sm" isDisabled={!selected.length || creating} onPress={create}>
              {creating ? "Creating…" : isGroup ? "Create" : "Chat"}
            </Button>
          ),
        }}
      />
      <UserPicker
        selected={selected}
        onToggle={toggle}
        header={
          selected.length ? (
            <View className="gap-3">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2"
              >
                {selected.map((user) => (
                  <Chip key={user._id} variant="soft" onPress={() => toggle(user)}>
                    <Chip.Label>@{user.username} ✕</Chip.Label>
                  </Chip>
                ))}
              </ScrollView>
              {isGroup ? (
                <TextField isInvalid={!!nameError}>
                  <Label>Group name</Label>
                  <Input
                    value={groupName}
                    onChangeText={(text) => {
                      setGroupName(text);
                      if (nameError) setNameError(undefined);
                    }}
                    placeholder="Weekend plans"
                    maxLength={GROUP_NAME_MAX}
                  />
                  <FieldError>{nameError}</FieldError>
                </TextField>
              ) : null}
            </View>
          ) : undefined
        }
      />
    </KeyboardAvoidingView>
  );
}
