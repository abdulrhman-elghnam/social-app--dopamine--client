import {
  Button,
  Card,
  ControlField,
  Description,
  Label,
  Separator,
  Typography,
  useToast,
} from "heroui-native";
import { useState, type JSX } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConfirmDialog } from "../../../component/confirm-dialog";
import { LoadingView } from "../../../component/state-views";
import { UserAvatar } from "../../../component/user-avatar";
import { useAuth } from "../../../context/auth-context";
import { displayName } from "../../../lib/format";
import { userApi } from "../../../api/posts";
import { errorMessage } from "../../../services/api";

function Stat({ value, label }: { value: number; label: string }): JSX.Element {
  return (
    <View className="flex-1 items-center gap-0.5">
      <Typography.Heading type="h5">{value}</Typography.Heading>
      <Typography.Paragraph type="body-xs" color="muted">
        {label}
      </Typography.Paragraph>
    </View>
  );
}

export default function ProfileScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { profile, signOut, reloadProfile } = useAuth();
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  if (!profile) return <LoadingView />;

  const isPrivate = profile.privacyController === "private";

  async function togglePrivacy(makePrivate: boolean): Promise<void> {
    setSavingPrivacy(true);
    try {
      await userApi.update({ privacyController: makePrivate ? "private" : "public" });
      await reloadProfile();
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

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-5 px-4"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
    >
      <Card className="items-center gap-3 py-6">
        <UserAvatar user={profile} size="lg" />
        <View className="items-center">
          <Typography.Heading type="h4">{displayName(profile)}</Typography.Heading>
          <Typography.Paragraph color="muted">@{profile.username}</Typography.Paragraph>
        </View>
        {profile.bio ? (
          <Typography.Paragraph align="center" className="px-4">
            {profile.bio}
          </Typography.Paragraph>
        ) : null}
        <Separator className="my-1" />
        <View className="flex-row self-stretch">
          <Stat value={profile.postsCount ?? 0} label="Posts" />
          <Stat value={profile.followersCount ?? 0} label="Followers" />
          <Stat value={profile.followingCount ?? 0} label="Following" />
        </View>
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
            <Description>Only approved followers can follow you.</Description>
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
