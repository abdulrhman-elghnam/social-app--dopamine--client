import { FieldError, InputOTP, Label, TextField } from "heroui-native";
import type { JSX } from "react";

interface OtpFieldProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  error?: string | undefined;
  isDisabled?: boolean;
}

/** 6-digit code input (3 + 3 slots) using HeroUI's InputOTP. */
export function OtpField({
  value,
  onChange,
  onComplete,
  error,
  isDisabled,
}: OtpFieldProps): JSX.Element {
  return (
    <TextField isInvalid={!!error} isDisabled={!!isDisabled}>
      <Label>Verification code</Label>
      <InputOTP
        maxLength={6}
        value={value}
        onChange={onChange}
        isInvalid={!!error}
        isDisabled={!!isDisabled}
        {...(onComplete ? { onComplete } : {})}
      >
        <InputOTP.Group>
          <InputOTP.Slot index={0} />
          <InputOTP.Slot index={1} />
          <InputOTP.Slot index={2} />
        </InputOTP.Group>
        <InputOTP.Separator />
        <InputOTP.Group>
          <InputOTP.Slot index={3} />
          <InputOTP.Slot index={4} />
          <InputOTP.Slot index={5} />
        </InputOTP.Group>
      </InputOTP>
      <FieldError>{error}</FieldError>
    </TextField>
  );
}
