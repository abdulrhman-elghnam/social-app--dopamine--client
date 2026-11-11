import { Button, Typography } from "heroui-native";
import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, TextInput, View } from "react-native";
import { useAuth } from "../../context/auth-context";
import { apiRequest } from "../../services/api";

export default function LoginScreen(): React.JSX.Element {
  const { credentials, loading: authLoading, signIn } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (credentials) router.replace("/profile");
  }, [credentials]);

  if (authLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (credentials) {
    return <View className="flex-1 bg-background" />;
  }

  async function login(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest<{
        access_token: string;
        refresh_token: string;
      }>("/authentication/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!response.data) throw new Error("Login response did not include credentials");
      await signIn(response.data);
      router.replace("/profile");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 justify-center px-6 bg-background gap-4">
      <Typography.Heading>Welcome back</Typography.Heading>
      <Typography.Paragraph>Sign in to your account.</Typography.Paragraph>
      <TextInput
        className="rounded-xl border border-divider bg-content1 px-4 py-3 text-foreground"
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        className="rounded-xl border border-divider bg-content1 px-4 py-3 text-foreground"
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Typography.Paragraph className="text-danger">{error}</Typography.Paragraph> : null}
      <Button onPress={login} isDisabled={loading || !email || !password}>
        {loading ? "Signing in..." : "Login"}
      </Button>
      <Button variant="ghost" onPress={() => router.push("/signup")}>
        Create an account
      </Button>
    </View>
  );
}
