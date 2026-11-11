import { Button, Card, Typography } from "heroui-native";
import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../context/auth-context";
import { apiRequest } from "../../services/api";

export default function ProfileScreen(): React.JSX.Element {
  const { credentials, signOut } = useAuth();
  const [profile, setProfile] = React.useState<Record<string, unknown> | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!credentials) return;
    apiRequest<Record<string, unknown>>("/user/profile", {}, true)
      .then((response) => setProfile(response.data ?? null))
      .catch((requestError) => setError(requestError.message));
  }, [credentials]);

  if (!credentials) {
    router.replace("/");
    return <View className="flex-1 bg-background" />;
  }

  async function changePrivacy(): Promise<void> {
    const action = profile?.privacyController === "PUBLIC" ? "PRIVATE" : "PUBLIC";
    try {
      const response = await apiRequest<{ privacyController: string }>(
        "/user/change-privacy",
        { method: "PUT", body: JSON.stringify({ action }) },
        true
      );
      setProfile((current) => ({ ...(current ?? {}), privacyController: response.data?.privacyController }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Update failed");
    }
  }

  async function logout(): Promise<void> {
    await signOut();
    router.replace("/");
  }

  if (!profile && !error) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center bg-background px-6">
      <Card className="gap-4">
        <Typography.Heading>{String(profile?.username ?? "Profile")}</Typography.Heading>
        <Typography.Paragraph>{String(profile?.email ?? "")}</Typography.Paragraph>
        <Typography.Paragraph>Privacy: {String(profile?.privacyController ?? "Unknown")}</Typography.Paragraph>
        {error ? <Typography.Paragraph className="text-danger">{error}</Typography.Paragraph> : null}
        <Button onPress={changePrivacy}>Change privacy</Button>
        <Button variant="ghost" onPress={logout}>Logout</Button>
      </Card>
    </View>
  );
}
