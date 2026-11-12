import { apiRequest } from "../services/api";
import type {
  Comment,
  LikeState,
  Post,
  PublicUser,
  Share,
  UpdateProfileInput,
  UserProfile,
  UserProfileView,
  Visibility,
} from "./types";

export interface PostInput {
  content: string;
  visibility: Visibility;
  commentsEnabled: boolean;
}

export const page = (p: number, size: number) => `page=${p}&size=${size}`;

/** Unwraps `data`, failing loudly when the server sent none. */
export const required = async <T>(request: Promise<{ data?: T }>, what: string): Promise<T> => {
  const { data } = await request;
  if (data === undefined || data === null) throw new Error(`${what} not found`);
  return data;
};

export const userApi = {
  profile: (): Promise<UserProfile> =>
    required(apiRequest<UserProfile>("/users/me", { auth: true }), "Profile"),
  update: (changes: UpdateProfileInput) =>
    apiRequest<UserProfile>("/users/me", { method: "PATCH", body: changes, auth: true }),
  /** multipart field `avatar` */
  uploadAvatar: (form: FormData) =>
    apiRequest<{ image: string }>("/users/me/avatar", { method: "PATCH", body: form, auth: true }),
  /** multipart field `coverImage` */
  uploadCover: (form: FormData) =>
    apiRequest<{ coverImage: string }>("/users/me/cover-image", {
      method: "PATCH",
      body: form,
      auth: true,
    }),
  search: (q: string, p: number, size: number) =>
    apiRequest<PublicUser[]>(`/users/search?q=${encodeURIComponent(q)}&${page(p, size)}`, {
      auth: true,
    }),
  suggestions: (p: number, size: number) =>
    apiRequest<PublicUser[]>(`/users/suggestions?${page(p, size)}`, { auth: true }),
  get: (userId: string): Promise<UserProfileView> =>
    required(apiRequest<UserProfileView>(`/users/${userId}`, { auth: true }), "User"),
  followers: (userId: string, p: number, size: number) =>
    apiRequest<PublicUser[]>(`/users/${userId}/followers?${page(p, size)}`, { auth: true }),
  following: (userId: string, p: number, size: number) =>
    apiRequest<PublicUser[]>(`/users/${userId}/following?${page(p, size)}`, { auth: true }),
  posts: (userId: string, p: number, size: number) =>
    apiRequest<Post[]>(`/users/${userId}/posts?${page(p, size)}`, { auth: true }),
  /** Accounts you've blocked, newest first. */
  blocked: (p: number, size: number) =>
    apiRequest<PublicUser[]>(`/users/me/blocked?${page(p, size)}`, { auth: true }),
  block: (userId: string) =>
    apiRequest<{ userId: string; isBlocked: true }>(`/users/${userId}/block`, {
      method: "POST",
      auth: true,
    }),
  unblock: (userId: string) =>
    apiRequest<{ userId: string; isBlocked: false }>(`/users/${userId}/block`, {
      method: "DELETE",
      auth: true,
    }),
  unfollow: (userId: string) =>
    apiRequest<{ userId: string; isFollowing: false }>(`/users/${userId}/follow`, {
      method: "DELETE",
      auth: true,
    }),
};

export const postApi = {
  /** Home feed: your posts plus those of people you follow. */
  feed: (p: number, size: number) => apiRequest<Post[]>(`/posts?${page(p, size)}`, { auth: true }),
  get: (postId: string): Promise<Post> =>
    required(apiRequest<Post>(`/posts/${postId}`, { auth: true }), "Post"),
  create: (input: PostInput): Promise<Post> =>
    required(apiRequest<Post>("/posts", { method: "POST", body: input, auth: true }), "Post"),
  update: (postId: string, input: Partial<PostInput>): Promise<Post> =>
    required(
      apiRequest<Post>(`/posts/${postId}`, { method: "PATCH", body: input, auth: true }),
      "Post"
    ),
  remove: (postId: string) => apiRequest(`/posts/${postId}`, { method: "DELETE", auth: true }),
  like: (postId: string) =>
    apiRequest<LikeState & { postId: string }>(`/posts/${postId}/like`, {
      method: "POST",
      auth: true,
    }),
  unlike: (postId: string) =>
    apiRequest<LikeState & { postId: string }>(`/posts/${postId}/like`, {
      method: "DELETE",
      auth: true,
    }),
  save: (postId: string) =>
    apiRequest<{ postId: string; isSaved: true }>(`/posts/${postId}/save`, {
      method: "POST",
      auth: true,
    }),
  unsave: (postId: string) =>
    apiRequest<{ postId: string; isSaved: false }>(`/posts/${postId}/save`, {
      method: "DELETE",
      auth: true,
    }),
  /** Public posts (or your own) only. */
  share: (postId: string, content?: string) =>
    apiRequest<{ share: Share; sharesCount: number }>(`/posts/${postId}/share`, {
      method: "POST",
      body: content ? { content } : {},
      auth: true,
    }),
};

export const commentApi = {
  list: (postId: string, p: number, size: number) =>
    apiRequest<Comment[]>(`/posts/${postId}/comments?${page(p, size)}`, { auth: true }),
  /** Pass `parentCommentId` to reply. */
  create: (postId: string, content: string, parentCommentId?: string): Promise<Comment> =>
    required(
      apiRequest<Comment>(`/posts/${postId}/comments`, {
        method: "POST",
        body: parentCommentId ? { content, parentCommentId } : { content },
        auth: true,
      }),
      "Comment"
    ),
  replies: (commentId: string, p: number, size: number) =>
    apiRequest<Comment[]>(`/comments/${commentId}/replies?${page(p, size)}`, { auth: true }),
  update: (commentId: string, content: string): Promise<Comment> =>
    required(
      apiRequest<Comment>(`/comments/${commentId}`, {
        method: "PATCH",
        body: { content },
        auth: true,
      }),
      "Comment"
    ),
  remove: (commentId: string) =>
    apiRequest<{ commentId: string; removedReplies: number }>(`/comments/${commentId}`, {
      method: "DELETE",
      auth: true,
    }),
  like: (commentId: string) =>
    apiRequest<LikeState & { commentId: string }>(`/comments/${commentId}/like`, {
      method: "POST",
      auth: true,
    }),
  unlike: (commentId: string) =>
    apiRequest<LikeState & { commentId: string }>(`/comments/${commentId}/like`, {
      method: "DELETE",
      auth: true,
    }),
};
