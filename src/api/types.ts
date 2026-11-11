/** Shapes returned by the Dopamine server. Ids and dates arrive as JSON strings. */

import type { PageMeta } from "../services/api";

export type Visibility = "public" | "followers" | "private";
export type Gender = "MALE" | "FEMALE";
export type Privacy = "public" | "private";

/** A populated id: the server sends either the bare id or the populated object. */
export type Ref<T extends { _id: string }> = string | T;

export const refId = <T extends { _id: string }>(ref: Ref<T>): string =>
  typeof ref === "string" ? ref : ref._id;

// ── users ──────────────────────────────────────────────────────────────────────

/** User populated with the server's `AUTHOR_FIELDS`. */
export interface Author {
  _id: string;
  firstName: string;
  lastName: string;
  username: string;
  image?: string;
}

/** User card from search, suggestions and follower lists (`PUBLIC_USER_FIELDS`). */
export interface PublicUser extends Author {
  bio?: string;
  privacyController: Privacy;
  followersCount: number;
  followingCount: number;
  postsCount: number;
}

/** `GET /users/me` — your own full record. */
export interface UserProfile extends PublicUser {
  email: string;
  coverImage?: string;
  phone?: string;
  DOB?: string;
  gender?: "male" | "female";
  isEmailVerified?: boolean;
  lastSeenAt?: string;
  createdAt?: string;
}

/** `PATCH /users/me` body — every field optional, at least one required. */
export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  username?: string;
  bio?: string;
  phone?: string;
  /** YYYY-MM-DD */
  DOB?: string;
  gender?: Gender;
  privacyController?: Privacy;
}

export type Relationship =
  | { isSelf: true }
  | {
      isSelf: false;
      isFollowing: boolean;
      followsYou: boolean;
      followRequest: { _id: string; status: "pending" } | null;
      isOnline: boolean;
    };

/** Fields a non-follower still sees on a private account. */
export type LimitedUser = Pick<
  PublicUser,
  | "_id"
  | "firstName"
  | "lastName"
  | "username"
  | "image"
  | "privacyController"
  | "followersCount"
  | "followingCount"
  | "postsCount"
>;

/** `GET /users/:userId` — full card, or the limited one when `isRestricted`. */
export type UserProfileView =
  | (PublicUser & { isRestricted: false; relationship: Relationship })
  | (LimitedUser & { isRestricted: true; relationship: Relationship })
  | (UserProfile & { relationship: { isSelf: true } });

// ── posts & comments ───────────────────────────────────────────────────────────

export interface Post {
  _id: string;
  /** Populated on list/detail responses; a bare id on create/update responses. */
  author: Ref<Author>;
  content?: string;
  visibility: Visibility;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  commentsEnabled: boolean;
  /** Viewer flags, present on feed / detail / user-post lists. */
  isLiked?: boolean;
  isSaved?: boolean;
  editedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  _id: string;
  post: string;
  author: Ref<Author>;
  /** Set on replies; replies are one level deep. */
  parentComment?: string;
  content: string;
  likesCount: number;
  repliesCount: number;
  /** Viewer flag, present on list responses. */
  isLiked?: boolean;
  editedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LikeState {
  isLiked: boolean;
  likesCount: number;
}
export interface Share {
  _id: string;
  user: string;
  post: string;
  content?: string;
  createdAt: string;
}

// ── follow requests ────────────────────────────────────────────────────────────

export type FollowRequestStatus = "pending" | "accepted" | "rejected";

/** In `received` lists `requester` is populated; in `sent` lists `recipient` is. */
export interface FollowRequest {
  _id: string;
  requester: Ref<Author>;
  recipient: Ref<Author>;
  status: FollowRequestStatus;
  createdAt: string;
  updatedAt: string;
}

/** `POST /follow-requests/:userId` — public accounts are followed at once. */
export type FollowResult =
  { status: "following" } | { status: "requested"; request: FollowRequest };

// ── notifications ──────────────────────────────────────────────────────────────

export type NotificationType =
  | "follow"
  | "follow_request"
  | "follow_accepted"
  | "like"
  | "comment"
  | "reply"
  | "comment_like"
  | "share";

export interface AppNotification {
  _id: string;
  recipient: string;
  sender: Ref<Author>;
  type: NotificationType;
  post?: string;
  comment?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationMeta extends PageMeta {
  unreadCount: number;
}

// ── messaging ──────────────────────────────────────────────────────────────────

export type MessageType = "text" | "image" | "video" | "audio" | "file";
export type MemberRole = "member" | "admin" | "owner";

export interface MessageMedia {
  url: string;
  type: "image" | "text";
}

/** Shape used for `conversation.lastMessage` and `message.replyTo`. */
export interface MessagePreview {
  _id: string;
  sender: string;
  content?: string;
  type: MessageType;
  createdAt: string;
  deletedAt?: string;
}

export interface Message {
  _id: string;
  conversation: string;
  sender: Ref<Author>;
  /** Removed when the message is deleted. */
  content?: string;
  media: MessageMedia[];
  type: MessageType;
  replyTo?: MessagePreview | string | null;
  readBy: string[];
  deliveredTo: string[];
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  _id: string;
  participants: Author[];
  lastMessage?: MessagePreview | null;
  isGroup: boolean;
  groupName?: string;
  groupImage?: string;
  createdBy?: string;
  admins: string[];
  createdAt: string;
  updatedAt: string;
}

/** `GET /conversations` items and `GET /conversations/:id` add the caller's membership. */
export interface ConversationView extends Conversation {
  isMuted: boolean;
  role?: MemberRole;
  onlineParticipants: string[];
  /** List only. */
  unreadCount?: number;
  /** Detail only. */
  lastReadMessage?: string | null;
}

export type CreateConversationInput =
  | { participantIds: [string]; isGroup?: false }
  | { participantIds: string[]; isGroup: true; groupName: string; groupImage?: string };

export interface UpdateGroupInput {
  groupName?: string;
  groupImage?: string;
  addMembers?: string[];
  removeMembers?: string[];
}

export interface ReadReceipt {
  conversationId: string;
  userId: string;
  messageId: string | null;
  readAt: string;
}

// ── reports ────────────────────────────────────────────────────────────────────

export type ReportTargetType = "user" | "post" | "comment";
export type ReportStatus = "pending" | "reviewed" | "resolved" | "rejected";

export interface CreateReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  description?: string;
}

export interface Report {
  _id: string;
  reporter: Ref<Author>;
  targetType: ReportTargetType;
  reportedUser?: Ref<Author>;
  post?: string | { _id: string; author: string; content?: string };
  comment?: string | { _id: string; author: string; post: string; content: string };
  reason: string;
  description?: string;
  status: ReportStatus;
  reviewedBy?: Ref<Author>;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Author id from a populated or bare author (same as `refId`). */
export const authorId = (author: Ref<Author>): string => refId(author);
