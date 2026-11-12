import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  Card,
  ControlField,
  Description,
  Label,
  Separator,
  Typography,
  useThemeColor,
  useToast,
} from "heroui-native";
import { router, type Href } from "expo-router";
import { useState, type ComponentProps, type JSX } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { userApi } from "../../../api/posts";
import { ConfirmDialog } from "../../../component/confirm-dialog";
import { ProfileHeader } from "../../../component/profile-header";
import { LoadingView } from "../../../component/state-views";
import { useAuth } from "../../../context/auth-context";
import { useRealtime } from "../../../context/realtime-context";
import { imageFormData, pickImage } from "../../../lib/image";
import { openUser } from "../../../lib/navigation";
import { errorMessage } from "../../../services/api";

type ImageKind = "avatar" | "cover";

const IMAGE_OPTIONS: Record<ImageKind, { aspect: [number, number]; maxSize: number }> = {
  avatar: { aspect: [1, 1], maxSize: 512 },
  cover: { aspect: [3, 1], maxSize: 1500 },
};

export default function ProfileScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { profile, signOut, reloadProfile, patchProfile } = useAuth();
  const { unreadNotifications } = useRealtime();
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  /** Local previews shown while a new photo uploads. */
  const [preview, setPreview] = useState<Partial<Record<ImageKind, string>>>({});
  const foreground = useThemeColor("foreground");

  if (!profile) return <LoadingView />;

  async function changeImage(kind: ImageKind): Promise<void> {
    let image;
    try {
      image = await pickImage(IMAGE_OPTIONS[kind]);
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Couldn't open that photo",
        description: errorMessage(error),
      });
      return;
    }
    if (!image) return;

    setPreview((current) => ({ ...current, [kind]: image.uri }));
    try {
      if (kind === "avatar") {
        const { data } = await userApi.uploadAvatar(await imageFormData("avatar", image));
        // Apply the confirmed path right away; a later refetch can't undo a successful upload.
        if (data?.image) patchProfile({ image: data.image });
        else await reloadProfile();
      } else {
        const { data } = await userApi.uploadCover(await imageFormData("coverImage", image));
        if (data?.coverImage) patchProfile({ coverImage: data.coverImage });
        else await reloadProfile();
      }
      toast.show({
        variant: "success",
        label: kind === "avatar" ? "Profile photo updated" : "Cover photo updated",
      });
    } catch (error) {
      toast.show({
        variant: "danger",
        label: kind === "avatar" ? "Couldn't update photo" : "Couldn't update cover",
        description: errorMessage(error),
      });
    } finally {
      setPreview(({ [kind]: _done, ...rest }) => rest);
    }
  }

  const isPrivate = profile.privacyController === "private";

  async function togglePrivacy(makePrivate: boolean): Promise<void> {
    setSavingPrivacy(true);
    try {
      const privacyController = makePrivate ? "private" : "public";
      await userApi.update({ privacyController });
      patchProfile({ privacyController });
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Couldn't update privacy",
        description: errorMessage(error),
      });
    } finally {
      setSavingPrivacy(false);
    }
  }

  const openList = (tab: "posts" | "followers" | "following") =>
    router.push({ pathname: "/user/[userId]", params: { userId: profile._id, tab } });

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-5 px-4"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
    >
      <View className="flex-row items-center justify-between">
        <Typography.Heading type="h3">Profile</Typography.Heading>
        <Pressable
          onPress={() => router.push("/settings")}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={10}
          className="size-10 items-center justify-center rounded-full bg-surface-secondary"
        >
          <Ionicons name="settings-outline" size={22} color={foreground} />
        </Pressable>
      </View>

      <ProfileHeader
        user={{
          ...profile,
          ...(preview.avatar ? { image: preview.avatar } : {}),
          ...(preview.cover ? { coverImage: preview.cover } : {}),
        }}
        onAvatarPress={() => void changeImage("avatar")}
        onCoverPress={() => void changeImage("cover")}
        avatarBusy={!!preview.avatar}
        coverBusy={!!preview.cover}
        onPostsPress={() => openList("posts")}
        onFollowersPress={() => openList("followers")}
        onFollowingPress={() => openList("following")}
        actions={
          <>
            <Button
              variant="secondary"
              className="flex-1"
              onPress={() => router.push("/edit-profile")}
            >
              <Ionicons name="create-outline" size={16} color={foreground} />
              <Button.Label>Edit profile</Button.Label>
            </Button>
            <Button variant="secondary" className="flex-1" onPress={() => openUser(profile._id)}>
              <Ionicons name="grid-outline" size={16} color={foreground} />
              <Button.Label>My posts</Button.Label>
            </Button>
          </>
        }
      />

      <Card className="gap-0 p-0">
        <MenuRow icon="person-add-outline" label="Follow requests" href="/follow-requests" />
        <Separator />
        <MenuRow
          icon="notifications-outline"
          label="Notifications"
          href="/notifications"
          badge={unreadNotifications}
        />
        <Separator />
        <MenuRow icon="shield-checkmark-outline" label="Privacy & security" href="/settings" />
        {profile.role === "admin" ? (
          <>
            <Separator />
            <MenuRow icon="flag-outline" label="Moderation · reports" href="/reports" />
          </>
        ) : null}
      </Card>

      <Card className="gap-4">
        <Card.Title>Account</Card.Title>
        <View className="gap-1">
          <Typography.Paragraph type="body-xs" color="muted">
            Email
          </Typography.Paragraph>
          <Typography.Paragraph>{profile.email}</Typography.Paragraph>
        </View>
        <Separator />
        <ControlField
          isSelected={isPrivate}
          onSelectedChange={(value) => void togglePrivacy(value)}
          isDisabled={savingPrivacy}
        >
          <View className="flex-1">
            <Label>Private account</Label>
            <Description>Only approved followers can see your posts and connections.</Description>
          </View>
          <ControlField.Indicator />
        </ControlField>
      </Card>

      <Button variant="danger-soft" onPress={() => setConfirmSignOut(true)}>
        Sign out
      </Button>

      <ConfirmDialog
        isOpen={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Sign out?"
        description="You'll need your email and password to sign back in."
        confirmLabel="Sign out"
        onConfirm={() => {
          setConfirmSignOut(false);
          void signOut();
        }}
      />
    </ScrollView>
  );
}

function MenuRow({
  icon,
  label,
  href,
  badge,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  href: Href;
  badge?: number;
}): JSX.Element {
  const [foreground, muted] = useThemeColor(["foreground", "muted"]);
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      className="flex-row items-center gap-3 px-4 py-3.5 active:bg-surface-secondary"
    >
      <View className="size-9 items-center justify-center rounded-full bg-surface-secondary">
        <Ionicons name={icon} size={18} color={foreground} />
      </View>
      <Typography className="flex-1" weight="medium">
        {label}
      </Typography>
      {badge ? (
        <View className="min-w-6 items-center rounded-full bg-danger px-1.5 py-0.5">
          <Typography type="body-xs" weight="bold" className="text-danger-foreground">
            {badge > 99 ? "99+" : badge}
          </Typography>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={muted} />
    </Pressable>
  );
}
