import { Button, LinkButton, Typography } from "heroui-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useState, type JSX } from "react";
import { View } from "react-native";
import { authApi } from "../../api/auth";
import { AuthLayout } from "../../component/auth-layout";
import { FormField } from "../../component/form-field";
import { useAuth } from "../../context/auth-context";
import { schemas, validateForm } from "../../lib/validation";
import { ApiError, errorMessage } from "../../services/api";

export default function LoginScreen(): JSX.Element {
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(): Promise<void> {
    const result = validateForm(schemas.login, { email, password });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});

    setSubmitting(true);
    setServerError(null);
    setNeedsVerification(false);
    try {
      await signIn(await authApi.login(result.data.email, result.data.password));
      // Stack.Protected swaps to the (app) group once credentials exist.
    } catch (error) {
      setServerError(errorMessage(error, "Login failed"));
      // 401 + "not verified" (messageCode 406) — offer the verification step.
      setNeedsVerification(
        error instanceof ApiError && error.status === 401 && /verif/i.test(error.message)
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to keep the dopamine flowing."
      error={serverError}
    >
      <FormField
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <FormField
        label="Password"
        placeholder="Your password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <View className="items-end">
        <Link href={{ pathname: "/forgot-password", params: { email: email.trim() } }} asChild>
          <LinkButton>Forgot password?</LinkButton>
        </Link>
      </View>

      {needsVerification ? (
        <Button
          variant="secondary"
          onPress={() =>
            router.push({ pathname: "/verify-email", params: { email: email.trim() } })
          }
        >
          Verify my email
        </Button>
      ) : null}

      <Button onPress={submit} isDisabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>

      <View className="flex-row items-center justify-center gap-1">
        <Typography.Paragraph type="body-sm" color="muted">
          New here?
        </Typography.Paragraph>
        <Link href="/signup" asChild>
          <LinkButton>Create an account</LinkButton>
        </Link>
      </View>
    </AuthLayout>
  );
}
