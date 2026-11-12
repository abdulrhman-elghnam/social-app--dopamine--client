import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Button, Menu, Separator, Tabs, Typography, useThemeColor, useToast } from "heroui-native";
import { useCallback, useEffect, useState, type JSX, type ReactElement } from "react";
import { ActivityIndicator, FlatList, RefreshControl, View } from "react-native";
import { conversationApi } from "../../../api/chat";
import { userApi } from "../../../api/posts";
import { followRequestApi } from "../../../api/social";
import type { Post, PublicUser, Relationship, UserProfileView } from "../../../api/types";
import { ConfirmDialog } from "../../../component/confirm-dialog";
import { PostCard } from "../../../component/post-card";
import { ReportDialog, type ReportTarget } from "../../../component/report-dialog";
import { EmptyState, LoadingView } from "../../../component/state-views";
import { ProfileHeader } from "../../../component/profile-header";
import { UserRow } from "../../../component/user-row";
import { useAuth } from "../../../context/auth-context";
import { usePaginatedList } from "../../../hook/use-paginated-list";
import { openConversation, openPost, openUser } from "../../../lib/navigation";
import { usePostEvents } from "../../../lib/post-events";
import { errorMessage } from "../../../services/api";

type ContentTab = "posts" | "followers" | "following";
type OtherRelationship = Extract<Relationship, { isSelf: false }>;
type Confirm = "unfollow" | "cancel-request" | "block";

export default function UserProfileScreen(): JSX.Element {
  const { userId: targetId, tab: initialTab } = useLocalSearchParams<{
    userId: string;
    tab?: ContentTab;
  }>();
  const { userId: me, reloadProfile } = useAuth();
  const { toast } = useToast();
  const [muted, foreground] = useThemeColor(["muted", "foreground"]);

  const [user, setUser] = useState<UserProfileView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<ContentTab>(
    initialTab === "followers" || initialTab === "following" ? initialTab : "posts"
  );
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [report, setReport] = useState<ReportTarget | null>(null);
  /** Bumped after follow changes so the content list refetches with new access. */
  const [contentVersion, setContentVersion] = useState(0);

  const load = useCallback(
    () =>
      userApi
        .get(targetId)
        .then((next) => {
          setUser(next);
          setLoadError(null);
        })
        .catch((error) => setLoadError(errorMessage(error, "This account isn't available"))),
    [targetId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ title: "Profile" }} />
        <EmptyState
          icon="person-remove-outline"
          title="Account unavailable"
          description={loadError}
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }
  if (!user) return <LoadingView />;

  const relationship = user.relationship.isSelf ? null : (user.relationship as OtherRelationship);
  const isRestricted = "isRestricted" in user && user.isRestricted;

  function patchRelationship(changes: Partial<OtherRelationship>, followersDelta = 0): void {
    setUser((current) =>
      current && !current.relationship.isSelf
        ? ({
            ...current,
            followersCount: Math.max(0, current.followersCount + followersDelta),
            relationship: { ...current.relationship, ...changes },
          } as UserProfileView)
        : current
    );
  }

  async function run(action: () => Promise<void>, failure: string): Promise<void> {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.show({ variant: "danger", label: failure, description: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  const follow = () =>
    run(async () => {
      const { data } = await followRequestApi.send(targetId);
      if (data?.status === "requested") {
        patchRelationship({ followRequest: { _id: data.request._id, status: "pending" } });
        toast.show({ variant: "success", label: "Follow request sent" });
      } else {
        patchRelationship({ isFollowing: true }, 1);
        // A private account opens up once you follow it.
        if (isRestricted) await load();
        setContentVersion((v) => v + 1);
        void reloadProfile();
      }
    }, "Couldn't follow");

  const unfollow = () =>
    run(async () => {
      await userApi.unfollow(targetId);
      patchRelationship({ isFollowing: false }, -1);
      if (user.privacyController === "private") await load();
      setContentVersion((v) => v + 1);
      void reloadProfile();
    }, "Couldn't unfollow");

  const cancelRequest = () =>
    run(async () => {
      if (!relationship?.followRequest) return;
      await followRequestApi.cancel(relationship.followRequest._id);
      patchRelationship({ followRequest: null });
    }, "Couldn't cancel request");

  const block = () =>
    run(async () => {
      await userApi.block(targetId);
      toast.show({ variant: "success", label: `Blocked @${user.username}` });
      void reloadProfile();
      router.back();
    }, "Couldn't block");

  const message = () =>
    run(async () => {
      const conversation = await conversationApi.create({ participantIds: [targetId] });
      openConversation(conversation._id);
    }, "Couldn't open chat");

  async function onConfirm(): Promise<void> {
    const action = confirm;
    setConfirm(null);
    if (action === "unfollow") await unfollow();
    if (action === "cancel-request") await cancelRequest();
    if (action === "block") await block();
  }

  function followButton(): ReactElement | null {
    if (!relationship) return null;
    if (relationship.isFollowing)
      return (
        <Button
          variant="secondary"
          className="flex-1"
          isDisabled={busy}
          onPress={() => setConfirm("unfollow")}
        >
          Following
        </Button>
      );
    if (relationship.followRequest)
      return (
        <Button
          variant="secondary"
          className="flex-1"
          isDisabled={busy}
          onPress={() => setConfirm("cancel-request")}
        >
          Requested
        </Button>
      );
    return (
      <Button className="flex-1" isDisabled={busy} onPress={follow}>
        {relationship.followsYou ? "Follow back" : "Follow"}
      </Button>
    );
  }

  const header = (
    <View className="gap-4 pb-2 pt-3">
      <ProfileHeader
        user={{ ...user, bio: "bio" in user ? user.bio : undefined }}
        note={relationship?.followsYou ? "Follows you" : undefined}
        isOnline={relationship?.isOnline}
        onPostsPress={isRestricted ? undefined : () => setTab("posts")}
        onFollowersPress={isRestricted ? undefined : () => setTab("followers")}
        onFollowingPress={isRestricted ? undefined : () => setTab("following")}
        actions={
          relationship ? (
            <>
              {followButton()}
              <Button variant="secondary" className="flex-1" isDisabled={busy} onPress={message}>
                <Ionicons name="chatbubble-outline" size={16} color={foreground} />
                <Button.Label>Message</Button.Label>
              </Button>
            </>
          ) : undefined
        }
      />

      {isRestricted ? null : (
        <Tabs value={tab} onValueChange={(value) => setTab(value as ContentTab)}>
          <Tabs.List>
            <Tabs.Indicator />
            <Tabs.Trigger value="posts">
              <Tabs.Label>Posts</Tabs.Label>
            </Tabs.Trigger>
            <Tabs.Trigger value="followers">
              <Tabs.Label>Followers</Tabs.Label>
            </Tabs.Trigger>
            <Tabs.Trigger value="following">
              <Tabs.Label>Following</Tabs.Label>
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: `@${user.username}`,
          headerRight: relationship
            ? () => (
                <Menu>
                  <Menu.Trigger asChild>
                    <Button variant="ghost" size="sm" isIconOnly accessibilityLabel="More options">
                      <Ionicons name="ellipsis-horizontal" size={20} color={muted} />
                    </Button>
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Overlay />
                    <Menu.Content presentation="popover" width={200}>
                      <Menu.Item onPress={() => setReport({ type: "user", id: targetId })}>
                        <Menu.ItemTitle>Report</Menu.ItemTitle>
                      </Menu.Item>
                      <Menu.Item variant="danger" onPress={() => setConfirm("block")}>
                        <Menu.ItemTitle>Block</Menu.ItemTitle>
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Portal>
                </Menu>
              )
            : undefined,
        }}
      />

      {isRestricted ? (
        <FlatList
          data={[]}
          renderItem={() => null}
          contentContainerClassName="px-4"
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState
              icon="lock-closed-outline"
              title="This account is private"
              description={
                relationship?.followRequest
                  ? "Your follow request is pending."
                  : "Follow this account to see their posts and connections."
              }
            />
          }
        />
      ) : (
        <ProfileContent
          key={`${tab}:${contentVersion}`}
          userId={targetId}
          tab={tab}
          header={header}
          isSelf={!relationship}
          viewerId={me}
          onRefreshProfile={load}
          onReportPost={(postId) => setReport({ type: "post", id: postId })}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm === "block"
            ? `Block @${user.username}?`
            : confirm === "unfollow"
              ? `Unfollow @${user.username}?`
              : "Cancel follow request?"
        }
        description={
          confirm === "block"
            ? "You won't see each other's profiles, posts or messages. Blocking also removes follows both ways."
            : confirm === "unfollow"
              ? user.privacyController === "private"
                ? "This account is private — you'll need to request again to see their posts."
                : "Their posts will no longer appear in your feed."
              : "They won't see your request anymore."
        }
        confirmLabel={
          confirm === "block" ? "Block" : confirm === "unfollow" ? "Unfollow" : "Cancel request"
        }
        isPending={busy}
        onConfirm={onConfirm}
      />
      <ReportDialog target={report} onClose={() => setReport(null)} />
    </View>
  );
}

interface ProfileContentProps {
  userId: string;
  tab: ContentTab;
  header: ReactElement;
  isSelf: boolean;
  viewerId: string | null;
  onRefreshProfile: () => Promise<void>;
  onReportPost: (postId: string) => void;
}

/** One paginated list per tab (remounted via `key`), with the profile card as its header. */
function ProfileContent({
  userId,
  tab,
  header,
  isSelf,
  viewerId,
  onRefreshProfile,
  onReportPost,
}: ProfileContentProps): JSX.Element {
  const fetcher = useCallback(
    (page: number, size: number) =>
      tab === "posts"
        ? userApi.posts(userId, page, size)
        : tab === "followers"
          ? userApi.followers(userId, page, size)
          : userApi.following(userId, page, size),
    [tab, userId]
  );
  const list = usePaginatedList<Post | PublicUser>(fetcher, 15);
  const { setItems } = list;

  usePostEvents((event) => {
    if (tab !== "posts") return;
    if (event.type === "deleted")
      setItems((items) => items.filter((item) => item._id !== event.postId));
    if (event.type === "updated")
      setItems((items) =>
        items.map((item) =>
          item._id === event.post._id
            ? ({ ...item, ...event.post, author: (item as Post).author } as Post)
            : item
        )
      );
  });

  const empty =
    tab === "posts"
      ? { icon: "document-text-outline" as const, title: "No posts yet" }
      : tab === "followers"
        ? { icon: "people-outline" as const, title: "No followers yet" }
        : { icon: "person-add-outline" as const, title: "Not following anyone yet" };

  return (
    <FlatList<Post | PublicUser>
      data={list.items}
      keyExtractor={(item) => item._id}
      contentContainerClassName="px-4 pb-10"
      ListHeaderComponent={
        <View>
          {header}
          {list.error ? (
            <Typography.Paragraph type="body-sm" className="py-2 text-danger">
              {list.error}
            </Typography.Paragraph>
          ) : null}
        </View>
      }
      ItemSeparatorComponent={
        tab === "posts" ? () => <View className="h-3" /> : () => <Separator />
      }
      renderItem={({ item }) =>
        tab === "posts" ? (
          <PostCard
            post={item as Post}
            isOwner={isSelf}
            onPress={() => openPost(item._id)}
            onReport={isSelf ? undefined : () => onReportPost(item._id)}
          />
        ) : (
          <UserRow
            user={item as PublicUser}
            showBio
            onPress={() => openUser(item._id)}
            subtitle={item._id === viewerId ? "You" : undefined}
          />
        )
      }
      ListEmptyComponent={
        list.loading ? (
          <ActivityIndicator className="py-8" />
        ) : list.error ? undefined : (
          <EmptyState icon={empty.icon} title={empty.title} />
        )
      }
      ListFooterComponent={list.loadingMore ? <ActivityIndicator className="py-4" /> : undefined}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl
          refreshing={list.refreshing}
          onRefresh={() => {
            void onRefreshProfile();
            void list.refresh();
          }}
        />
      }
    />
  );
}
