import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Button, Card, Separator, Typography, useThemeColor, useToast } from "heroui-native";
import { useState, type JSX } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from "react-native";
import { userApi } from "../../api/posts";
import type { PublicUser } from "../../api/types";
import { ConfirmDialog } from "../../component/confirm-dialog";
import { EmptyState } from "../../component/state-views";
import { ThemePicker } from "../../component/theme-picker";
import { UserRow } from "../../component/user-row";
import { useAuth } from "../../context/auth-context";
import { usePaginatedList } from "../../hook/use-paginated-list";
import { displayName } from "../../lib/format";
import { errorMessage } from "../../services/api";

/** Settings: appearance, security (password, sessions) and the accounts you've blocked. */
export default function SettingsScreen(): JSX.Element {
  const { toast } = useToast();
  const { profile, signOut } = useAuth();
  const [foreground, muted, danger] = useThemeColor(["foreground", "muted", "danger"]);
  const [confirmSignOutAll, setConfirmSignOutAll] = useState(false);
  // Google accounts have no password to change.
  const hasPassword = profile?.provider !== "google";
  const list = usePaginatedList<PublicUser>(userApi.blocked, 20);
  const { setItems } = list;
  const [pending, setPending] = useState<PublicUser | null>(null);
  const [unblocking, setUnblocking] = useState(false);

  async function unblock(user: PublicUser): Promise<void> {
    setUnblocking(true);
    try {
      await userApi.unblock(user._id);
      setItems((items) => items.filter((item) => item._id !== user._id));
      toast.show({ variant: "success", label: `Unblocked ${displayName(user)}` });
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Couldn't unblock",
        description: errorMessage(error),
      });
    } finally {
      setUnblocking(false);
      setPending(null);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={list.items}
        keyExtractor={(item) => item._id}
        contentContainerClassName="gap-0 px-4 pb-10 pt-4"
        ListHeaderComponent={
          <View className="gap-5 pb-2">
            <Card className="gap-4">
              <Card.Title>Appearance</Card.Title>
              <ThemePicker />
            </Card>
            <Card className="gap-0 p-0">
              <View className="px-4 pb-1 pt-4">
                <Card.Title>Security</Card.Title>
              </View>
              {hasPassword ? (
                <>
                  <Pressable
                    onPress={() => router.push("/change-password")}
                    accessibilityRole="button"
                    className="flex-row items-center gap-3 px-4 py-3.5 active:bg-surface-secondary"
                  >
                    <Ionicons name="key-outline" size={20} color={foreground} />
                    <View className="flex-1">
                      <Typography weight="medium">Change password</Typography>
                      <Typography.Paragraph type="body-xs" color="muted">
                        {"We'll email you a code to confirm it's you."}
                      </Typography.Paragraph>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={muted} />
                  </Pressable>
                  <Separator />
                </>
              ) : null}
              <Pressable
                onPress={() => setConfirmSignOutAll(true)}
                accessibilityRole="button"
                className="flex-row items-center gap-3 px-4 py-3.5 active:bg-surface-secondary"
              >
                <Ionicons name="log-out-outline" size={20} color={danger} />
                <View className="flex-1">
                  <Typography weight="medium" className="text-danger">
                    Sign out of all devices
                  </Typography>
                  <Typography.Paragraph type="body-xs" color="muted">
                    Ends every session, including this one.
                  </Typography.Paragraph>
                </View>
              </Pressable>
            </Card>
            <View className="gap-1">
              <Typography.Heading type="h6">Blocked accounts</Typography.Heading>
              <Typography.Paragraph type="body-xs" color="muted">
                {"You and blocked accounts can't see each other's profiles, posts or messages."}
              </Typography.Paragraph>
              {list.error ? (
                <Typography.Paragraph type="body-sm" className="pt-1 text-danger">
                  {list.error}
                </Typography.Paragraph>
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <UserRow
            user={item}
            accessory={
              <Button size="sm" variant="secondary" onPress={() => setPending(item)}>
                Unblock
              </Button>
            }
          />
        )}
        ItemSeparatorComponent={() => <Separator />}
        ListEmptyComponent={
          list.loading ? (
            <ActivityIndicator className="py-8" />
          ) : list.error ? undefined : (
            <EmptyState
              icon="shield-checkmark-outline"
              title="No blocked accounts"
              description="People you block from their profile show up here."
            />
          )
        }
        ListFooterComponent={list.loadingMore ? <ActivityIndicator className="py-4" /> : undefined}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
      />

      <ConfirmDialog
        isOpen={pending !== null}
        onOpenChange={(open) => {
          if (!open && !unblocking) setPending(null);
        }}
        title={pending ? `Unblock ${displayName(pending)}?` : "Unblock?"}
        description="They'll be able to see your profile and posts again. They won't be told, and past follows aren't restored."
        confirmLabel="Unblock"
        isPending={unblocking}
        onConfirm={() => {
          if (pending) void unblock(pending);
        }}
      />
      <ConfirmDialog
        isOpen={confirmSignOutAll}
        onOpenChange={setConfirmSignOutAll}
        title="Sign out everywhere?"
        description="You'll be signed out on every phone and browser where you're logged in, including this one."
        confirmLabel="Sign out all"
        onConfirm={() => {
          setConfirmSignOutAll(false);
          void signOut({ everywhere: true });
        }}
      />
    </View>
  );
}
