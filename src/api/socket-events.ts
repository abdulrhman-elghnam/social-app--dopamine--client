/**
 * Socket.IO contract with the server (`server/source/realtime/socket.events.ts`).
 * Use with socket.io-client: `io(API_BASE_URL, { auth: { token } }) as Socket<ServerToClientEvents, ClientToServerEvents>`.
 */
import type {
  AppNotification,
  Conversation,
  Message,
  MessageMedia,
  MessageType,
  ReadReceipt,
} from "./types";

export type AckResponse<T = unknown> =
  { ok: true; data?: T } | { ok: false; error: string; messageCode?: number };
export type Ack<T = unknown> = (response: AckResponse<T>) => void;

export interface SendMessageInput {
  conversationId: string;
  content?: string;
  type?: MessageType;
  media?: MessageMedia[];
  replyTo?: string;
  /** Echoed back on `message:new` so an optimistic bubble can be matched. */
  clientId?: string;
}

export interface ClientToServerEvents {
  "conversation:join": (
    payload: { conversationId: string },
    ack?: Ack<{ conversationId: string }>
  ) => void;
  "conversation:leave": (
    payload: { conversationId: string },
    ack?: Ack<{ conversationId: string }>
  ) => void;
  "message:send": (payload: SendMessageInput, ack?: Ack<Message & { clientId?: string }>) => void;
  "message:read": (
    payload: { conversationId: string; messageId?: string },
    ack?: Ack<ReadReceipt>
  ) => void;
  "message:edit": (
    payload: { messageId: string; content: string },
    ack?: Ack<MessageEdited>
  ) => void;
  "message:delete": (payload: { messageId: string }, ack?: Ack<MessageDeleted>) => void;
  "typing:start": (payload: { conversationId: string }, ack?: Ack) => void;
  "typing:stop": (payload: { conversationId: string }, ack?: Ack) => void;
  "notification:read": (
    payload: { notificationId: string },
    ack?: Ack<{ notificationId: string; unreadCount: number }>
  ) => void;
}

export interface MessageEdited {
  conversationId: string;
  messageId: string;
  content?: string;
  editedAt?: string;
}
export interface MessageDeleted {
  conversationId: string;
  messageId: string;
}
export interface Presence {
  userId: string;
  isOnline: boolean;
  lastSeenAt: string | null;
}

export interface ServerToClientEvents {
  "message:new": (message: Message & { clientId?: string }) => void;
  "message:delivered": (payload: {
    conversationId: string;
    messageId: string;
    deliveredTo: string[];
  }) => void;
  "message:read:update": (payload: ReadReceipt) => void;
  "message:edited": (payload: MessageEdited) => void;
  "message:deleted": (payload: MessageDeleted) => void;
  "typing:update": (payload: { conversationId: string; userId: string; isTyping: boolean }) => void;
  "conversation:updated": (conversation: Conversation) => void;
  "presence:online": (payload: Presence) => void;
  "presence:offline": (payload: Presence) => void;
  "presence:update": (payload: Presence) => void;
  "notification:new": (payload: { notification: AppNotification; unreadCount: number }) => void;
  "notification:read:update": (
    payload: { notificationId: string; unreadCount: number } | { all: true; unreadCount: number }
  ) => void;
}
