import { apiRequest } from "../services/api";
import { page, required } from "./posts";
import type {
  ConversationView,
  CreateConversationInput,
  Message,
  ReadReceipt,
  UpdateGroupInput,
} from "./types";

/** REST side of messaging; sending, editing and deleting messages go over the socket (see socket-events.ts). */
export const conversationApi = {
  list: (p: number, size: number) =>
    apiRequest<ConversationView[]>(`/conversations?${page(p, size)}`, { auth: true }),
  /** A direct chat that already exists is returned instead of duplicated. */
  create: (input: CreateConversationInput): Promise<ConversationView> =>
    required(
      apiRequest<ConversationView>("/conversations", { method: "POST", body: input, auth: true }),
      "Conversation"
    ),
  get: (id: string): Promise<ConversationView> =>
    required(apiRequest<ConversationView>(`/conversations/${id}`, { auth: true }), "Conversation"),
  /** Group admins only. */
  updateGroup: (id: string, input: UpdateGroupInput) =>
    apiRequest<ConversationView>(`/conversations/${id}`, {
      method: "PATCH",
      body: input,
      auth: true,
    }),
  /** Newest first. */
  messages: (id: string, p: number, size: number) =>
    apiRequest<Message[]>(`/conversations/${id}/messages?${page(p, size)}`, { auth: true }),
  mute: (id: string, muted: boolean) =>
    apiRequest<{ conversationId: string; isMuted: boolean }>(`/conversations/${id}/mute`, {
      method: "PATCH",
      body: { muted },
      auth: true,
    }),
  /** Omit `messageId` to mark everything read. */
  markRead: (id: string, messageId?: string) =>
    apiRequest<ReadReceipt>(`/conversations/${id}/read`, {
      method: "PATCH",
      body: messageId ? { messageId } : {},
      auth: true,
    }),
};
