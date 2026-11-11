import { Button, useToast } from "heroui-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState, type JSX } from "react";
import { authApi } from "../../api/auth";
import { AuthLayout } from "../../component/auth-layout";
import { FormField } from "../../component/form-field";
import { OtpField } from "../../component/otp-field";
import { validate } from "../../lib/validation";
import { errorMessage } from "../../services/api";

export default function VerifyEmailScreen(): JSX.Element {
  const { toast } = useToast();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState<{ email?: string; otp?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(code = otp): Promise<void> {
    const found = { email: validate.email(email), otp: validate.otp(code) };
    setErrors(found);
    if (found.email || found.otp) return;

    setSubmitting(true);
    setServerError(null);
    try {
      await authApi.verifyEmail(email.trim().toLowerCase(), code);
      toast.show({
        variant: "success",
        label: "Email verified",
        description: "You can sign in now.",
      });
      router.replace({ pathname: "/login", params: { email: email.trim().toLowerCase() } });
    } catch (error) {
      setServerError(errorMessage(error, "Verification failed"));
      setOtp("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Check your inbox"
      subtitle={
        params.email
          ? `We sent a 6-digit code to ${params.email}. It expires in 10 minutes.`
          : "Enter your email and the 6-digit code we sent you."
      }
      error={serverError}
    >
      {params.email ? null : (
        <FormField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      )}
      <OtpField
        value={otp}
        onChange={setOtp}
        onComplete={(code) => void submit(code)}
        error={errors.otp}
        isDisabled={submitting}
      />
      <Button onPress={() => void submit()} isDisabled={submitting}>
        {submitting ? "Verifying…" : "Verify email"}
      </Button>
      <Button variant="ghost" onPress={() => router.replace("/login")}>
        Back to sign in
      </Button>
    </AuthLayout>
  );
}
