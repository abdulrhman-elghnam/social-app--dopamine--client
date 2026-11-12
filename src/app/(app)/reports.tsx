import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Chip, Tabs, Typography, useThemeColor, useToast } from "heroui-native";
import { useCallback, useState, type ComponentProps, type JSX } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from "react-native";
import { reportApi } from "../../api/social";
import { refId, type Author, type Report, type ReportStatus } from "../../api/types";
import { EmptyState } from "../../component/state-views";
import { UserAvatar } from "../../component/user-avatar";
import { useAuth } from "../../context/auth-context";
import { usePaginatedList } from "../../hook/use-paginated-list";
import { displayName, timeAgo } from "../../lib/format";
import { openPost, openUser } from "../../lib/navigation";
import { errorMessage } from "../../services/api";

type Decision = Exclude<ReportStatus, "pending">;

const STATUS_TABS: { value: ReportStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "reviewed", label: "Reviewed" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
];

const TARGET_ICON: Record<Report["targetType"], ComponentProps<typeof Ionicons>["name"]> = {
  user: "person-outline",
  post: "document-text-outline",
  comment: "chatbubble-outline",
};

/** Admin moderation queue: `GET /reports?status=` and `PATCH /reports/:id/review`. */
export default function ReportsScreen(): JSX.Element {
  const { profile } = useAuth();
  const [status, setStatus] = useState<ReportStatus>("pending");

  if (profile && profile.role !== "admin") {
    return (
      <View className="flex-1 bg-background">
        <EmptyState
          icon="lock-closed-outline"
          title="Admins only"
          description="You don't have access to moderation."
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pb-2 pt-3">
        <Tabs value={status} onValueChange={(value) => setStatus(value as ReportStatus)}>
          <Tabs.List>
            <Tabs.Indicator />
            {STATUS_TABS.map((tab) => (
              <Tabs.Trigger key={tab.value} value={tab.value}>
                <Tabs.Label>{tab.label}</Tabs.Label>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs>
      </View>
      <ReportList key={status} status={status} />
    </View>
  );
}

function ReportList({ status }: { status: ReportStatus }): JSX.Element {
  const { toast } = useToast();
  const fetcher = useCallback(
    (page: number, size: number) => reportApi.list(page, size, { status }),
    [status]
  );
  const list = usePaginatedList<Report>(fetcher, 15);
  const { setItems } = list;
  const [busyId, setBusyId] = useState<string | null>(null);

  async function review(report: Report, decision: Decision): Promise<void> {
    setBusyId(report._id);
    try {
      await reportApi.review(report._id, decision);
      // It now belongs to another tab.
      setItems((items) => items.filter((item) => item._id !== report._id));
      toast.show({ variant: "success", label: `Marked ${decision}` });
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Couldn't update report",
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
      contentContainerClassName="gap-3 px-4 pb-10 pt-2"
      ListHeaderComponent={
        list.error ? (
          <Typography.Paragraph type="body-sm" className="text-danger">
            {list.error}
          </Typography.Paragraph>
        ) : undefined
      }
      renderItem={({ item }) => (
        <ReportCard
          report={item}
          busy={busyId === item._id}
          onReview={status === "pending" || status === "reviewed" ? review : undefined}
        />
      )}
      ListEmptyComponent={
        list.loading ? (
          <ActivityIndicator className="py-8" />
        ) : list.error ? undefined : (
          <EmptyState
            icon="checkmark-done-outline"
            title={status === "pending" ? "Queue is clear" : `No ${status} reports`}
            description={status === "pending" ? "New reports will show up here." : undefined}
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

const asAuthor = (ref: Report["reporter"] | undefined): Author | null =>
  ref && typeof ref !== "string" ? ref : null;

function ReportCard({
  report,
  busy,
  onReview,
}: {
  report: Report;
  busy: boolean;
  onReview?: ((report: Report, decision: Decision) => Promise<void>) | undefined;
}): JSX.Element {
  const [muted, foreground] = useThemeColor(["muted", "foreground"]);
  const reporter = asAuthor(report.reporter);
  const reported = asAuthor(report.reportedUser);
  const reviewer = asAuthor(report.reviewedBy);

  const post = typeof report.post === "object" ? report.post : null;
  const comment = typeof report.comment === "object" ? report.comment : null;
  const excerpt = comment?.content ?? post?.content;

  const openTarget = (): void => {
    if (report.targetType === "post" && report.post) openPost(refId(report.post));
    else if (report.targetType === "comment" && comment) openPost(comment.post);
    else if (reported) openUser(reported._id);
  };

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-2">
        <Chip size="sm" variant="soft" color="default">
          <Ionicons name={TARGET_ICON[report.targetType]} size={12} color={muted} />
          <Chip.Label className="capitalize">{report.targetType}</Chip.Label>
        </Chip>
        <Typography weight="semibold" className="flex-1" numberOfLines={1}>
          {report.reason}
        </Typography>
        <Typography.Paragraph type="body-xs" color="muted">
          {timeAgo(report.createdAt)}
        </Typography.Paragraph>
      </View>

      {report.description ? (
        <Typography.Paragraph type="body-sm">{report.description}</Typography.Paragraph>
      ) : null}

      <Pressable
        onPress={openTarget}
        accessibilityRole="button"
        accessibilityLabel="Open reported content"
        className="gap-2 rounded-xl border border-separator bg-surface-secondary p-3"
      >
        {reported ? (
          <View className="flex-row items-center gap-2">
            <UserAvatar user={reported} size="sm" />
            <View className="flex-1">
              <Typography type="body-sm" weight="semibold">
                {displayName(reported)}
              </Typography>
              <Typography.Paragraph type="body-xs" color="muted">
                @{reported.username}
              </Typography.Paragraph>
            </View>
            <Ionicons name="open-outline" size={16} color={muted} />
          </View>
        ) : null}
        {excerpt ? (
          <Typography.Paragraph type="body-sm" color="muted" numberOfLines={4}>
            {excerpt}
          </Typography.Paragraph>
        ) : report.targetType !== "user" ? (
          <Typography.Paragraph type="body-xs" color="muted">
            Content no longer available.
          </Typography.Paragraph>
        ) : null}
      </Pressable>

      <View className="flex-row items-center gap-1.5">
        <Ionicons name="person-circle-outline" size={14} color={muted} />
        <Typography.Paragraph type="body-xs" color="muted" className="flex-1">
          Reported by {reporter ? `@${reporter.username}` : "someone"}
          {reviewer ? ` · reviewed by @${reviewer.username}` : ""}
        </Typography.Paragraph>
      </View>

      {onReview ? (
        <View className="flex-row gap-2">
          <Button
            size="sm"
            className="flex-1"
            isDisabled={busy}
            onPress={() => void onReview(report, "resolved")}
          >
            Resolve
          </Button>
          {report.status === "pending" ? (
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              isDisabled={busy}
              onPress={() => void onReview(report, "reviewed")}
            >
              <Ionicons name="eye-outline" size={14} color={foreground} />
              <Button.Label>Reviewing</Button.Label>
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="danger-soft"
            className="flex-1"
            isDisabled={busy}
            onPress={() => void onReview(report, "rejected")}
          >
            Reject
          </Button>
        </View>
      ) : null}
    </Card>
  );
}
