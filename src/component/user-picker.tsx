import { Ionicons } from "@expo/vector-icons";
import { Checkbox, Input, Separator, Typography, useThemeColor } from "heroui-native";
import { useEffect, useRef, useState, type JSX, type ReactElement } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { userApi } from "../api/posts";
import type { PublicUser } from "../api/types";
import { errorMessage } from "../services/api";
import { UserRow } from "./user-row";

const SEARCH_DEBOUNCE_MS = 350;

interface UserPickerProps {
  selected: PublicUser[];
  onToggle: (user: PublicUser) => void;
  /** Already members etc. — hidden from results. */
  excludeIds?: string[];
  header?: ReactElement;
}

/** Search-as-you-type user list with checkboxes; shows suggestions when the query is empty. */
export function UserPicker({
  selected,
  onToggle,
  excludeIds = [],
  header,
}: UserPickerProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const muted = useThemeColor("muted");

  useEffect(() => {
    const id = ++requestId.current;
    const q = query.trim();
    const timer = setTimeout(
      () => {
        (q ? userApi.search(q, 1, 20) : userApi.suggestions(1, 20))
          .then((response) => {
            if (id !== requestId.current) return;
            setResults(response.data ?? []);
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

  const selectedIds = new Set(selected.map((user) => user._id));
  const hidden = new Set(excludeIds);
  const visible = results.filter((user) => !hidden.has(user._id));

  return (
    <FlatList
      data={visible}
      keyExtractor={(user) => user._id}
      contentContainerClassName="px-4 pb-10"
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View className="gap-3 pb-2 pt-3">
          {header}
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search people"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {error ? (
            <Typography.Paragraph type="body-sm" className="text-danger">
              {error}
            </Typography.Paragraph>
          ) : null}
          {!query.trim() && visible.length ? (
            <Typography.Paragraph type="body-xs" color="muted">
              Suggested
            </Typography.Paragraph>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <UserRow
          user={item}
          onPress={() => onToggle(item)}
          accessory={
            <Checkbox
              isSelected={selectedIds.has(item._id)}
              onSelectedChange={() => onToggle(item)}
              accessibilityLabel={`Select ${item.username}`}
            />
          }
        />
      )}
      ItemSeparatorComponent={() => <Separator />}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator className="py-8" />
        ) : (
          <View className="items-center gap-2 py-10">
            <Ionicons name="search-outline" size={28} color={muted} />
            <Typography.Paragraph color="muted">No people found</Typography.Paragraph>
          </View>
        )
      }
    />
  );
}
