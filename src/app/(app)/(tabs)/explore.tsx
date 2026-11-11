import { Button, Card, Typography } from "heroui-native";
import React from "react";
import { FlatList, TextInput, View } from "react-native";
import { userApi } from "../../../api/posts";
import type { PublicUser } from "../../../api/types";
import { displayName } from "../../../lib/format";
import { useAuth } from "../../../context/auth-context";

export default function ExploreTab(): React.JSX.Element {
  const { credentials } = useAuth();
  const [query, setQuery] = React.useState("");
  const [users, setUsers] = React.useState<PublicUser[]>([]);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!credentials) return;
    userApi
      .suggestions(1, 10)
      .then((response) => setUsers(response.data ?? []))
      .catch((requestError) => setError(requestError.message));
  }, [credentials]);

  async function search(): Promise<void> {
    setError("");
    try {
      const response = await userApi.search(query.trim(), 1, 10);
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
        <Button onPress={search} isDisabled={!query}>
          Search
        </Button>
      </View>
      {error ? <Typography.Paragraph className="text-danger">{error}</Typography.Paragraph> : null}
      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <Card className="my-1 p-4">
            <Typography.Paragraph className="font-semibold">
              {displayName(item)}
            </Typography.Paragraph>
            <Typography.Paragraph className="text-muted">@{item.username}</Typography.Paragraph>
            {item.bio ? <Typography.Paragraph>{item.bio}</Typography.Paragraph> : null}
          </Card>
        )}
      />
    </View>
  );
}
