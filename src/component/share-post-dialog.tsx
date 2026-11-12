import { Button, Dialog, Label, TextArea, TextField, Typography, useToast } from "heroui-native";
import { useState, type JSX } from "react";
import { View } from "react-native";
import { postApi } from "../api/posts";
import type { Post } from "../api/types";
import { errorMessage } from "../services/api";

const CAPTION_MAX = 1000;

interface SharePostDialogProps {
  /** Dialog is open while a post is set. */
  post: Post | null;
  onClose: () => void;
  onShared: (sharesCount: number) => void;
}

/** `POST /posts/:postId/share` with an optional caption. */
export function SharePostDialog({ post, onClose, onShared }: SharePostDialogProps): JSX.Element {
  const { toast } = useToast();
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);

  function close(): void {
    if (sending) return;
    setCaption("");
    onClose();
  }

  async function share(): Promise<void> {
    if (!post) return;
    setSending(true);
    try {
      const { data } = await postApi.share(post._id, caption.trim() || undefined);
      if (data) onShared(data.sharesCount);
      toast.show({ variant: "success", label: "Post shared" });
      setSending(false);
      close();
    } catch (error) {
      setSending(false);
      toast.show({ variant: "danger", label: "Couldn't share", description: errorMessage(error) });
    }
  }

  return (
    <Dialog isOpen={!!post} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="gap-4">
          <View className="gap-1.5">
            <Dialog.Title>Share post</Dialog.Title>
            <Dialog.Description>Add a few words of your own, or share it as is.</Dialog.Description>
          </View>
          {post?.content ? (
            <View className="rounded-xl border border-separator bg-surface-secondary px-3 py-2.5">
              <Typography.Paragraph type="body-sm" color="muted" numberOfLines={3}>
                {post.content}
              </Typography.Paragraph>
            </View>
          ) : null}
          <TextField>
            <Label>Caption (optional)</Label>
            <TextArea
              value={caption}
              onChangeText={setCaption}
              placeholder="What do you think?"
              maxLength={CAPTION_MAX}
              className="min-h-20"
            />
          </TextField>
          <View className="flex-row justify-end gap-3">
            <Button variant="ghost" size="sm" onPress={close}>
              Cancel
            </Button>
            <Button size="sm" isDisabled={sending} onPress={share}>
              {sending ? "Sharing…" : "Share"}
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
