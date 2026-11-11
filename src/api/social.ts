import { apiRequest } from "../services/api";
import { page } from "./posts";
import type {
  AppNotification,
  CreateReportInput,
  FollowRequest,
  FollowResult,
  NotificationMeta,
  Report,
  ReportStatus,
  ReportTargetType,
} from "./types";

export const followRequestApi = {
  /** Follows a public account at once, or sends a request to a private one. */
  send: (userId: string) =>
    apiRequest<FollowResult>(`/follow-requests/${userId}`, { method: "POST", auth: true }),
  accept: (requestId: string) =>
    apiRequest<FollowRequest>(`/follow-requests/${requestId}/accept`, {
      method: "PATCH",
      auth: true,
    }),
  reject: (requestId: string) =>
    apiRequest<FollowRequest>(`/follow-requests/${requestId}/reject`, {
      method: "PATCH",
      auth: true,
    }),
  cancel: (requestId: string) =>
    apiRequest(`/follow-requests/${requestId}`, { method: "DELETE", auth: true }),
  received: (p: number, size: number) =>
    apiRequest<FollowRequest[]>(`/follow-requests/received?${page(p, size)}`, { auth: true }),
  sent: (p: number, size: number) =>
    apiRequest<FollowRequest[]>(`/follow-requests/sent?${page(p, size)}`, { auth: true }),
};

export const notificationApi = {
  list: (p: number, size: number, unreadOnly = false) =>
    apiRequest<AppNotification[], NotificationMeta>(
      `/notifications?${page(p, size)}${unreadOnly ? "&unread=true" : ""}`,
      { auth: true }
    ),
  markRead: (id: string) =>
    apiRequest<{ notificationId: string; unreadCount: number }>(`/notifications/${id}/read`, {
      method: "PATCH",
      auth: true,
    }),
  markAllRead: () =>
    apiRequest<{ updated: number; unreadCount: 0 }>("/notifications/read-all", {
      method: "PATCH",
      auth: true,
    }),
  remove: (id: string) => apiRequest(`/notifications/${id}`, { method: "DELETE", auth: true }),
};

export const reportApi = {
  create: (input: CreateReportInput) =>
    apiRequest<Report>("/reports", { method: "POST", body: input, auth: true }),
  /** Admin, or the reporter. */
  get: (id: string) => apiRequest<Report>(`/reports/${id}`, { auth: true }),
  /** Admin only. */
  list: (
    p: number,
    size: number,
    filter: { status?: ReportStatus; targetType?: ReportTargetType } = {}
  ) => {
    const extra = Object.entries(filter)
      .map(([key, value]) => `&${key}=${value}`)
      .join("");
    return apiRequest<Report[]>(`/reports?${page(p, size)}${extra}`, { auth: true });
  },
  /** Admin only. */
  review: (id: string, status: Exclude<ReportStatus, "pending">) =>
    apiRequest<Report>(`/reports/${id}/review`, { method: "PATCH", body: { status }, auth: true }),
};
