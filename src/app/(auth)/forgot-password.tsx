import { Button, useToast } from "heroui-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState, type JSX } from "react";
import { authApi } from "../../api/auth";
import { AuthLayout } from "../../component/auth-layout";
import { FormField } from "../../component/form-field";
import { OtpField } from "../../component/otp-field";
import { schemas, validateForm } from "../../lib/validation";
import { errorMessage } from "../../services/api";

type Step = "email" | "code" | "password";

const COPY: Record<Step, { title: string; subtitle: (email: string) => string }> = {
  email: {
    title: "Reset your password",
    subtitle: () => "Enter the email on your account and we'll send you a reset code.",
  },
  code: {
    title: "Enter the code",
    subtitle: (email) => `We sent a 6-digit code to ${email}.`,
  },
  password: {
    title: "Choose a new password",
    subtitle: () => "You'll be signed out on every device after changing it.",
  },
};

export default function ForgotPasswordScreen(): JSX.Element {
  const { toast } = useToast();
  const params = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(params.email ?? "");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  async function run(action: () => Promise<void>): Promise<void> {
    setSubmitting(true);
    setServerError(null);
    try {
      await action();
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  const sendCode = () => {
    const result = validateForm(schemas.forgotPasswordEmail, { email });
    setErrors(result.success ? {} : result.errors);
    if (!result.success) return;
    void run(async () => {
      await authApi.requestPasswordReset(normalizedEmail);
      setOtp("");
      setStep("code");
    });
  };

  const verifyCode = (code = otp) => {
    const result = validateForm(schemas.forgotPasswordCode, { otp: code });
    setErrors(result.success ? {} : result.errors);
    if (!result.success) return;
    void run(async () => {
      await authApi.verifyPasswordReset(normalizedEmail, code);
      setStep("password");
    });
  };

  const changePassword = () => {
    const result = validateForm(schemas.resetPassword, { password, confirmPassword });
    setErrors(result.success ? {} : result.errors);
    if (!result.success) return;
    void run(async () => {
      await authApi.changePassword(normalizedEmail, otp, password, confirmPassword);
      toast.show({
        variant: "success",
        label: "Password updated",
        description: "Sign in with your new password.",
      });
      router.replace({ pathname: "/login", params: { email: normalizedEmail } });
    });
  };

  return (
    <AuthLayout
      title={COPY[step].title}
      subtitle={COPY[step].subtitle(normalizedEmail)}
      error={serverError}
    >
      {step === "email" ? (
        <>
          <FormField
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            error={errors["email"]}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={sendCode}
          />
          <Button onPress={sendCode} isDisabled={submitting}>
            {submitting ? "Sending…" : "Send reset code"}
          </Button>
        </>
      ) : null}

      {step === "code" ? (
        <>
          <OtpField
            value={otp}
            onChange={setOtp}
            onComplete={(code) => verifyCode(code)}
            error={errors["otp"]}
            isDisabled={submitting}
          />
          <Button onPress={() => verifyCode()} isDisabled={submitting}>
            {submitting ? "Checking…" : "Continue"}
          </Button>
          <Button variant="ghost" onPress={sendCode} isDisabled={submitting}>
            Send a new code
          </Button>
        </>
      ) : null}

      {step === "password" ? (
        <>
          <FormField
            label="New password"
            placeholder="At least 8 characters"
            hint="Upper & lower case, a number and one of @$!%*?&"
            value={password}
            onChangeText={setPassword}
            error={errors["password"]}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <FormField
            label="Confirm new password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={errors["confirmPassword"]}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={changePassword}
          />
          <Button onPress={changePassword} isDisabled={submitting}>
            {submitting ? "Saving…" : "Update password"}
          </Button>
        </>
      ) : null}

      <Button variant="ghost" onPress={() => router.replace("/login")}>
        Back to sign in
      </Button>
    </AuthLayout>
  );
}
