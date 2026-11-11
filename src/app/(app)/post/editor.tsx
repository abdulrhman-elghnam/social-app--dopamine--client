import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Button,
  ControlField,
  Description,
  FieldError,
  Label,
  Radio,
  RadioGroup,
  Separator,
  TextArea,
  TextField,
  Typography,
  useThemeColor,
  useToast,
} from "heroui-native";
import { useEffect, useState, type JSX } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { postApi } from "../../../api/posts";
import type { Visibility } from "../../../api/types";
import { VISIBILITY_META } from "../../../component/post-card";
import { LoadingView } from "../../../component/state-views";
import { emitPostEvent } from "../../../lib/post-events";
import { validate } from "../../../lib/validation";
import { errorMessage } from "../../../services/api";

const MAX_LENGTH = 5000;
const VISIBILITY_HINT: Record<Visibility, string> = {
  public: "Anyone can see it",
  followers: "Only people who follow you",
  private: "Only you",
};

/** Create (no params) or edit (`?postId=`) a post. */
export default function PostEditorScreen(): JSX.Element {
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  const isEditing = !!postId;
  const { toast } = useToast();
  const muted = useThemeColor("muted");

  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [contentError, setContentError] = useState<string>();
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!postId) return;
    postApi
      .get(postId)
      .then((post) => {
        setContent(post.content ?? "");
        setVisibility(post.visibility);
        setCommentsEnabled(post.commentsEnabled);
      })
      .catch((error) => {
        toast.show({
          variant: "danger",
          label: "Couldn't open post",
          description: errorMessage(error),
        });
        router.back();
      })
      .finally(() => setLoading(false));
  }, [postId, toast]);

  async function save(): Promise<void> {
    const error = validate.postContent(content);
    setContentError(error);
    if (error) return;

    setSaving(true);
    try {
      const input = { content: content.trim(), visibility, commentsEnabled };
      if (postId) {
        const post = await postApi.update(postId, input);
        emitPostEvent({ type: "updated", post });
        toast.show({ variant: "success", label: "Post updated" });
      } else {
        const post = await postApi.create(input);
        emitPostEvent({ type: "created", post });
        toast.show({ variant: "success", label: "Posted" });
      }
      router.back();
    } catch (err) {
      toast.show({
        variant: "danger",
        label: "Couldn't save post",
        description: errorMessage(err),
      });
    } finally {
      setSaving(false);
    }
  }

  const header = (
    <Stack.Screen
      options={{
        title: isEditing ? "Edit post" : "New post",
        headerRight: () => (
          <Button size="sm" onPress={save} isDisabled={saving || loading || !content.trim()}>
            {saving ? "Saving…" : isEditing ? "Save" : "Post"}
          </Button>
        ),
      }}
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <LoadingView />
      </>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {header}
      <ScrollView contentContainerClassName="gap-6 p-5" keyboardShouldPersistTaps="handled">
        <TextField isInvalid={!!contentError}>
          <Label>What’s on your mind?</Label>
          <TextArea
            value={content}
            onChangeText={(text) => {
              setContent(text);
              if (contentError) setContentError(undefined);
            }}
            placeholder="Share a thought, a win, a question…"
            maxLength={MAX_LENGTH}
            autoFocus={!isEditing}
            className="min-h-40"
          />
          <View className="flex-row justify-between">
            <FieldError>{contentError}</FieldError>
            <Typography.Paragraph type="body-xs" color="muted" className="ml-auto">
              {content.length}/{MAX_LENGTH}
            </Typography.Paragraph>
          </View>
        </TextField>

        <Separator />

        <View className="gap-3">
          <Label>Who can see this?</Label>
          <RadioGroup
            value={visibility}
            onValueChange={(v) => setVisibility(v as Visibility)}
            className="gap-3"
          >
            {(Object.keys(VISIBILITY_META) as Visibility[]).map((value) => (
              <RadioGroup.Item key={value} value={value} className="items-center">
                <Ionicons name={VISIBILITY_META[value].icon} size={20} color={muted} />
                <View className="flex-1">
                  <Label>{VISIBILITY_META[value].label}</Label>
                  <Description>{VISIBILITY_HINT[value]}</Description>
                </View>
                <Radio />
              </RadioGroup.Item>
            ))}
          </RadioGroup>
        </View>

        <Separator />

        <ControlField isSelected={commentsEnabled} onSelectedChange={setCommentsEnabled}>
          <View className="flex-1">
            <Label>Allow comments</Label>
            <Description>Turn off to stop new comments on this post.</Description>
          </View>
          <ControlField.Indicator />
        </ControlField>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
