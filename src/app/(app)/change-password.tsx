import { Ionicons } from "@expo/vector-icons";
import { Alert, Button, Card, Typography, useThemeColor, useToast } from "heroui-native";
import { useState, type JSX } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authApi } from "../../api/auth";
import { FormField } from "../../component/form-field";
import { OtpField } from "../../component/otp-field";
import { LoadingView } from "../../component/state-views";
import { useAuth } from "../../context/auth-context";
import { schemas, validateForm } from "../../lib/validation";
import { errorMessage } from "../../services/api";

type Step = "intro" | "form";

/**
 * Signed-in password change. The server requires the emailed OTP (same code as a reset) and then
 * revokes every session, so this ends with a local sign-out.
 */
export default function ChangePasswordScreen(): JSX.Element {
  const { profile, signOut } = useAuth();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const accent = useThemeColor("accent");
  const [step, setStep] = useState<Step>("intro");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!profile) return <LoadingView />;
  const email = profile.email;

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

  const sendCode = () =>
    run(async () => {
      await authApi.requestPasswordReset(email);
      setOtp("");
      setStep("form");
      toast.show({ variant: "success", label: "Code sent", description: `Check ${email}.` });
    });

  const submit = () => {
    const result = validateForm(schemas.changePassword, { otp, password, confirmPassword });
    setErrors(result.success ? {} : result.errors);
    if (!result.success) return;
    void run(async () => {
      await authApi.changePassword(email, otp, password, confirmPassword);
      toast.show({
        variant: "success",
        label: "Password updated",
        description: "Sign in again with your new password.",
      });
      await signOut({ localOnly: true });
    });
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerClassName="gap-5 px-5 pt-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center gap-3">
          <View className="size-16 items-center justify-center rounded-full bg-accent/15">
            <Ionicons name="key-outline" size={30} color={accent} />
          </View>
          <Typography.Heading type="h4" align="center">
            {step === "intro" ? "Change your password" : "Enter the code"}
          </Typography.Heading>
          <Typography.Paragraph color="muted" align="center">
            {step === "intro"
              ? `We'll send a 6-digit code to ${email}. After the change you'll be signed out on every device.`
              : `We sent a 6-digit code to ${email}.`}
          </Typography.Paragraph>
        </View>

        {serverError ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{serverError}</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : null}

        {step === "intro" ? (
          <Button onPress={() => void sendCode()} isDisabled={submitting}>
            {submitting ? "Sending…" : "Email me a code"}
          </Button>
        ) : (
          <Card className="gap-4">
            <OtpField value={otp} onChange={setOtp} error={errors["otp"]} isDisabled={submitting} />
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
              onSubmitEditing={submit}
            />
            <Button onPress={submit} isDisabled={submitting}>
              {submitting ? "Saving…" : "Update password"}
            </Button>
            <Button variant="ghost" onPress={() => void sendCode()} isDisabled={submitting}>
              Send a new code
            </Button>
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
