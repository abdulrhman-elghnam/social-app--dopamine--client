import {
  Button,
  Dialog,
  Label,
  Radio,
  RadioGroup,
  TextArea,
  TextField,
  useToast,
} from "heroui-native";
import { useState, type JSX } from "react";
import { ScrollView, View } from "react-native";
import { reportApi } from "../api/social";
import type { ReportTargetType } from "../api/types";
import { ApiError, errorMessage } from "../services/api";

export interface ReportTarget {
  type: ReportTargetType;
  id: string;
}

const REASONS = [
  "Spam",
  "Harassment or bullying",
  "Hate speech",
  "Nudity or sexual content",
  "Violence or threats",
  "False information",
  "Something else",
] as const;

const TARGET_LABEL: Record<ReportTargetType, string> = {
  user: "account",
  post: "post",
  comment: "comment",
};

const DESCRIPTION_MAX = 1000;

interface ReportDialogProps {
  /** Dialog is open while a target is set. */
  target: ReportTarget | null;
  onClose: () => void;
}

/** Report a user, post or comment (`POST /reports`). Reviewed by admins. */
export function ReportDialog({ target, onClose }: ReportDialogProps): JSX.Element {
  const { toast } = useToast();
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);

  function close(): void {
    if (sending) return;
    setReason(REASONS[0]);
    setDescription("");
    onClose();
  }

  async function submit(): Promise<void> {
    if (!target) return;
    setSending(true);
    try {
      await reportApi.create({
        targetType: target.type,
        targetId: target.id,
        reason,
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      toast.show({
        variant: "success",
        label: "Report sent",
        description: "Thanks — our team will review it.",
      });
      setSending(false);
      close();
    } catch (error) {
      setSending(false);
      // 409: an open report from you already exists for this target.
      const already = error instanceof ApiError && error.status === 409;
      toast.show({
        variant: already ? "default" : "danger",
        label: already ? "Already reported" : "Couldn't send report",
        description: already ? "You've already reported this." : errorMessage(error),
      });
      if (already) close();
    }
  }

  return (
    <Dialog isOpen={!!target} onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="max-h-[85%] gap-4">
          <View className="gap-1.5">
            <Dialog.Title>Report {target ? TARGET_LABEL[target.type] : ""}</Dialog.Title>
            <Dialog.Description>
              Why are you reporting this? Your report is anonymous.
            </Dialog.Description>
          </View>
          <ScrollView contentContainerClassName="gap-4" keyboardShouldPersistTaps="handled">
            <RadioGroup value={reason} onValueChange={setReason} className="gap-2.5">
              {REASONS.map((value) => (
                <RadioGroup.Item key={value} value={value} className="items-center">
                  <Label className="flex-1">{value}</Label>
                  <Radio />
                </RadioGroup.Item>
              ))}
            </RadioGroup>
            <TextField>
              <Label>Details (optional)</Label>
              <TextArea
                value={description}
                onChangeText={setDescription}
                placeholder="Anything that helps us understand"
                maxLength={DESCRIPTION_MAX}
                className="min-h-20"
              />
            </TextField>
          </ScrollView>
          <View className="flex-row justify-end gap-3">
            <Button variant="ghost" size="sm" onPress={close}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" isDisabled={sending} onPress={submit}>
              {sending ? "Sending…" : "Report"}
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
