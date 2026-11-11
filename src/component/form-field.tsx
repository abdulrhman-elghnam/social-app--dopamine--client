import { Description, FieldError, Input, Label, TextField, type InputProps } from "heroui-native";
import type { JSX } from "react";

interface FormFieldProps extends Omit<InputProps, "isInvalid"> {
  label: string;
  error?: string | undefined;
  hint?: string;
  isRequired?: boolean;
}

/** HeroUI TextField with label, input, optional hint and an animated error line. */
export function FormField({
  label,
  error,
  hint,
  isRequired,
  isDisabled,
  ...inputProps
}: FormFieldProps): JSX.Element {
  return (
    <TextField isInvalid={!!error} isRequired={!!isRequired} isDisabled={!!isDisabled}>
      <Label>{label}</Label>
      <Input {...inputProps} />
      {hint && !error ? <Description>{hint}</Description> : null}
      <FieldError>{error}</FieldError>
    </TextField>
  );
}
