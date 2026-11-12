import type { Author, Conversation, Message, MessagePreview } from "../api/types";
import { displayName } from "./format";

/** The other person in a direct chat (or the first other member of a group). */
export const otherParticipant = (
  conversation: Conversation,
  me: string | null
): Author | undefined =>
  conversation.participants.find((participant) => participant._id !== me) ??
  conversation.participants[0];

export function conversationTitle(conversation: Conversation, me: string | null): string {
  if (conversation.isGroup) return conversation.groupName || "Group";
  const other = otherParticipant(conversation, me);
  return other ? displayName(other) : "Conversation";
}

/** Avatar input for a conversation: the other user, or the group name as initials. */
export function conversationAvatar(
  conversation: Conversation,
  me: string | null
): Pick<Author, "firstName" | "lastName" | "username" | "image"> {
  if (!conversation.isGroup) {
    const other = otherParticipant(conversation, me);
    if (other) return other;
  }
  const [first = "", second = ""] = (conversation.groupName || "Group").split(/\s+/);
  return {
    firstName: first,
    lastName: second,
    username: conversation.groupName || "group",
    ...(conversation.groupImage ? { image: conversation.groupImage } : {}),
  };
}

export function messagePreview(
  message: MessagePreview | Message | null | undefined,
  me: string | null
): string {
  if (!message) return "No messages yet";
  if (message.deletedAt) return "Message deleted";
  const sender = typeof message.sender === "string" ? message.sender : message.sender._id;
  const prefix = sender === me ? "You: " : "";
  if (message.content) return prefix + message.content;
  return prefix + (message.type === "image" ? "Photo" : "Attachment");
}

/** Shape a full message into the `lastMessage` preview the list uses. */
export const toPreview = (message: Message): MessagePreview => ({
  _id: message._id,
  sender: typeof message.sender === "string" ? message.sender : message.sender._id,
  type: message.type,
  createdAt: message.createdAt,
  ...(message.content !== undefined ? { content: message.content } : {}),
  ...(message.deletedAt ? { deletedAt: message.deletedAt } : {}),
});

/** Client-generated id for optimistic messages, echoed back by the server as `clientId`. */
export const newClientId = (): string =>
  `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
