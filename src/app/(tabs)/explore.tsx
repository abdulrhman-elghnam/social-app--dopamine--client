import { Button, Card, Typography } from "heroui-native";
import React from "react";
import { FlatList, TextInput, View } from "react-native";
import { apiRequest } from "../../services/api";
import { useAuth } from "../../context/auth-context";

export default function ExploreTab(): React.JSX.Element {
  const { credentials } = useAuth();
  const [query, setQuery] = React.useState("");
  const [users, setUsers] = React.useState<Record<string, unknown>[]>([]);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!credentials) return;
    apiRequest<Record<string, unknown>[]>(
      "/user/suggestions/1/10",
      {},
      true
    )
      .then((response) => setUsers(response.data ?? []))
      .catch((requestError) => setError(requestError.message));
  }, [credentials]);

  async function search(): Promise<void> {
    setError("");
    try {
      const response = await apiRequest<Record<string, unknown>[]>(
        `/user/search/${encodeURIComponent(query)}/1/10`,
        {},
        true
      );
      setUsers(response.data ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Search failed");
    }
  }

  return (
    <View className="flex-1 bg-background px-5 pt-14 gap-3">
      <Typography.Heading>Discover</Typography.Heading>
      <View className="flex-row gap-2">
        <TextInput
          className="flex-1 rounded-xl border border-divider bg-content1 px-4 py-3 text-foreground"
          placeholder="Search users"
          value={query}
          onChangeText={setQuery}
        />
        <Button onPress={search} isDisabled={!query}>Search</Button>
      </View>
      {error ? <Typography.Paragraph className="text-danger">{error}</Typography.Paragraph> : null}
      <FlatList
        data={users}
        keyExtractor={(item, index) => String(item._id ?? item.id ?? index)}
        renderItem={({ item }) => (
          <Card className="my-1 p-4">
            <Typography.Paragraph className="font-semibold">
              {String(item.username ?? item.fullName ?? "User")}
            </Typography.Paragraph>
            <Typography.Paragraph>{String(item.email ?? "")}</Typography.Paragraph>
          </Card>
        )}
      />
    </View>
  );
}
