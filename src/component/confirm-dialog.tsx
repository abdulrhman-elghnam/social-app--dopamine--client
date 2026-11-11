import { Button, Dialog } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

interface ConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
}

/** Destructive-action confirmation built on HeroUI's Dialog. */
export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  isPending = false,
  onConfirm,
}: ConfirmDialogProps): JSX.Element {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="gap-4">
          <View className="gap-1.5">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Description>{description}</Dialog.Description>
          </View>
          <View className="flex-row justify-end gap-3">
            <Button variant="ghost" size="sm" onPress={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" isDisabled={isPending} onPress={onConfirm}>
              {isPending ? "Deleting…" : confirmLabel}
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
