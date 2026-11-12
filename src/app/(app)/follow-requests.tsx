import { Stack } from "expo-router";
import { Button, Separator, Tabs, Typography, useToast } from "heroui-native";
import { useCallback, useState, type JSX } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";
import { followRequestApi } from "../../api/social";
import { refId, type FollowRequest } from "../../api/types";
import { EmptyState } from "../../component/state-views";
import { UserRow } from "../../component/user-row";
import { useAuth } from "../../context/auth-context";
import { usePaginatedList } from "../../hook/use-paginated-list";
import { timeAgo } from "../../lib/format";
import { openUser } from "../../lib/navigation";
import { errorMessage } from "../../services/api";

type Box = "received" | "sent";

export default function FollowRequestsScreen(): JSX.Element {
  const [box, setBox] = useState<Box>("received");
  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: "Follow requests" }} />
      <View className="px-4 pb-2 pt-3">
        <Tabs value={box} onValueChange={(value) => setBox(value as Box)}>
          <Tabs.List>
            <Tabs.Indicator />
            <Tabs.Trigger value="received">
              <Tabs.Label>Received</Tabs.Label>
            </Tabs.Trigger>
            <Tabs.Trigger value="sent">
              <Tabs.Label>Sent</Tabs.Label>
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs>
      </View>
      <RequestList key={box} box={box} />
    </View>
  );
}

function RequestList({ box }: { box: Box }): JSX.Element {
  const { toast } = useToast();
  const { reloadProfile } = useAuth();
  const fetcher = useCallback(
    (page: number, size: number) =>
      box === "received"
        ? followRequestApi.received(page, size)
        : followRequestApi.sent(page, size),
    [box]
  );
  const list = usePaginatedList<FollowRequest>(fetcher, 20);
  const { setItems } = list;
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(
    request: FollowRequest,
    action: "accept" | "reject" | "cancel"
  ): Promise<void> {
    setBusyId(request._id);
    try {
      await followRequestApi[action](request._id);
      setItems((items) => items.filter((item) => item._id !== request._id));
      if (action === "accept") {
        toast.show({ variant: "success", label: "Request accepted" });
        void reloadProfile();
      }
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Something went wrong",
        description: errorMessage(error),
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <FlatList
      data={list.items}
      keyExtractor={(item) => item._id}
      contentContainerClassName="px-4 pb-10"
      ListHeaderComponent={
        list.error ? (
          <Typography.Paragraph type="body-sm" className="py-2 text-danger">
            {list.error}
          </Typography.Paragraph>
        ) : undefined
      }
      renderItem={({ item }) => {
        const other = box === "received" ? item.requester : item.recipient;
        if (typeof other === "string") return null;
        const busy = busyId === item._id;
        return (
          <UserRow
            user={other}
            subtitle={`@${other.username} · ${timeAgo(item.createdAt)}`}
            onPress={() => openUser(refId(other))}
            accessory={
              box === "received" ? (
                <View className="flex-row gap-2">
                  <Button size="sm" isDisabled={busy} onPress={() => void act(item, "accept")}>
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    isDisabled={busy}
                    onPress={() => void act(item, "reject")}
                  >
                    Decline
                  </Button>
                </View>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={busy}
                  onPress={() => void act(item, "cancel")}
                >
                  Cancel
                </Button>
              )
            }
          />
        );
      }}
      ItemSeparatorComponent={() => <Separator />}
      ListEmptyComponent={
        list.loading ? (
          <ActivityIndicator className="py-8" />
        ) : list.error ? undefined : (
          <EmptyState
            icon="people-outline"
            title={box === "received" ? "No pending requests" : "No sent requests"}
            description={
              box === "received"
                ? "When someone asks to follow your private account, it shows up here."
                : "Requests you send to private accounts show up here until they're answered."
            }
          />
        )
      }
      ListFooterComponent={list.loadingMore ? <ActivityIndicator className="py-4" /> : undefined}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.4}
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
    />
  );
}
