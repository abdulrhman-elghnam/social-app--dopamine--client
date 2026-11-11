import {
  Button,
  FieldError,
  Label,
  LinkButton,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "heroui-native";
import { Link, router } from "expo-router";
import { useState, type JSX } from "react";
import { View } from "react-native";
import { authApi, type SignupInput } from "../../api/auth";
import type { Gender } from "../../api/types";
import { AuthLayout } from "../../component/auth-layout";
import { DateField } from "../../component/date-field";
import { FormField } from "../../component/form-field";
import { validate, validateAll } from "../../lib/validation";
import { errorMessage } from "../../services/api";

type Field = keyof SignupInput;

const yearsAgo = (years: number) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date;
};
/** Server accepts ages 18–100. */
const DOB_LIMITS = { min: yearsAgo(100), max: yearsAgo(18), initial: yearsAgo(25) };

export default function SignupScreen(): JSX.Element {
  const [form, setForm] = useState<Omit<SignupInput, "gender"> & { gender: Gender | "" }>({
    email: "",
    username: "",
    fullName: "",
    phoneNumber: "",
    DOB: "",
    gender: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (field: Field) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  async function submit(): Promise<void> {
    const found = validateAll<Field>({
      fullName: [form.fullName, validate.fullName],
      username: [form.username, validate.username],
      email: [form.email, validate.email],
      phoneNumber: [form.phoneNumber, validate.phone],
      DOB: [form.DOB, validate.dob],
      gender: [form.gender, (v) => (v ? undefined : "Choose one")],
      password: [form.password, validate.password],
      confirmPassword: [form.confirmPassword, validate.confirm(form.password)],
    });
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    setServerError(null);
    try {
      const email = form.email.trim().toLowerCase();
      await authApi.signup({
        ...form,
        email,
        username: form.username.trim(),
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        gender: form.gender as Gender,
      });
      router.replace({ pathname: "/verify-email", params: { email } });
    } catch (error) {
      setServerError(errorMessage(error, "Sign up failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="It takes a minute. We'll email you a code to verify it's you."
      error={serverError}
    >
      <FormField
        label="Full name"
        placeholder="Mona Ahmed"
        value={form.fullName}
        onChangeText={set("fullName")}
        error={errors.fullName}
        autoComplete="name"
        textContentType="name"
      />
      <FormField
        label="Username"
        placeholder="mona_ahmed"
        value={form.username}
        onChangeText={set("username")}
        error={errors.username}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
      />
      <FormField
        label="Email"
        placeholder="you@example.com"
        value={form.email}
        onChangeText={set("email")}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <FormField
        label="Phone number"
        placeholder="01012345678"
        value={form.phoneNumber}
        onChangeText={set("phoneNumber")}
        error={errors.phoneNumber}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />
      <DateField
        label="Date of birth"
        hint="You must be at least 18."
        value={form.DOB}
        onChange={set("DOB")}
        error={errors.DOB}
        minimumDate={DOB_LIMITS.min}
        maximumDate={DOB_LIMITS.max}
        initialDate={DOB_LIMITS.initial}
      />

      <TextField isInvalid={!!errors.gender}>
        <Label>Gender</Label>
        <RadioGroup
          value={form.gender || undefined}
          onValueChange={set("gender")}
          className="flex-row gap-6"
        >
          <RadioGroup.Item value="MALE">
            <Radio />
            <Label>Male</Label>
          </RadioGroup.Item>
          <RadioGroup.Item value="FEMALE">
            <Radio />
            <Label>Female</Label>
          </RadioGroup.Item>
        </RadioGroup>
        <FieldError>{errors.gender}</FieldError>
      </TextField>

      <FormField
        label="Password"
        placeholder="At least 8 characters"
        hint="Upper & lower case, a number and one of @$!%*?&"
        value={form.password}
        onChangeText={set("password")}
        error={errors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <FormField
        label="Confirm password"
        placeholder="Repeat your password"
        value={form.confirmPassword}
        onChangeText={set("confirmPassword")}
        error={errors.confirmPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <Button onPress={submit} isDisabled={submitting}>
        {submitting ? "Creating account…" : "Create account"}
      </Button>

      <View className="flex-row items-center justify-center gap-1">
        <Typography.Paragraph type="body-sm" color="muted">
          Already have an account?
        </Typography.Paragraph>
        <Link href="/login" asChild>
          <LinkButton>Sign in</LinkButton>
        </Link>
      </View>
    </AuthLayout>
  );
}
