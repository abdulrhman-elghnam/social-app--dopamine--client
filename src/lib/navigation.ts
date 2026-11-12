import { router } from "expo-router";

/** Shared push helpers so every screen opens users, posts and chats the same way. */
export const openUser = (userId: string) =>
  router.push({ pathname: "/user/[userId]", params: { userId } });

export const openPost = (postId: string) =>
  router.push({ pathname: "/post/[postId]", params: { postId } });

export const openConversation = (conversationId: string) =>
  router.push({ pathname: "/chat/[conversationId]", params: { conversationId } });
