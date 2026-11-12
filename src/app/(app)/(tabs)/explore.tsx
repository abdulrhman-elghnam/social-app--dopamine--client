import { Input, Separator, Typography } from "heroui-native";
import { useEffect, useRef, useState, type JSX } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { userApi } from "../../../api/posts";
import type { PublicUser } from "../../../api/types";
import { EmptyState } from "../../../component/state-views";
import { UserRow } from "../../../component/user-row";
import { openUser } from "../../../lib/navigation";
import { errorMessage } from "../../../services/api";

const SEARCH_DEBOUNCE_MS = 350;

export default function ExploreTab(): JSX.Element {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Suggestions when the box is empty, debounced search otherwise; stale responses are dropped.
  useEffect(() => {
    const id = ++requestId.current;
    const q = query.trim();
    const timer = setTimeout(
      () => {
        (q ? userApi.search(q, 1, 20) : userApi.suggestions(1, 20))
          .then((response) => {
            if (id !== requestId.current) return;
            setUsers(response.data ?? []);
            setError(null);
          })
          .catch((err) => {
            if (id === requestId.current) setError(errorMessage(err, "Search failed"));
          })
          .finally(() => {
            if (id === requestId.current) setLoading(false);
          });
      },
      q ? SEARCH_DEBOUNCE_MS : 0
    );
    return () => clearTimeout(timer);
  }, [query]);

  const searching = !!query.trim();

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        contentContainerClassName="px-4"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View className="gap-3 pb-2">
            <Typography.Heading type="h3">Discover</Typography.Heading>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name or username"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {error ? (
              <Typography.Paragraph type="body-sm" className="text-danger">
                {error}
              </Typography.Paragraph>
            ) : null}
            <Typography.Paragraph type="body-xs" color="muted">
              {searching ? "Results" : "People you may know"}
            </Typography.Paragraph>
          </View>
        }
        renderItem={({ item }) => (
          <UserRow
            user={item}
            showBio
            subtitle={`@${item.username} · ${item.followersCount} followers`}
            onPress={() => openUser(item._id)}
          />
        )}
        ItemSeparatorComponent={() => <Separator />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator className="py-8" />
          ) : error ? undefined : (
            <EmptyState
              icon={searching ? "search-outline" : "people-outline"}
              title={searching ? "No one found" : "No suggestions right now"}
              description={searching ? "Try a different name or username." : undefined}
            />
          )
        }
      />
    </View>
  );
}
