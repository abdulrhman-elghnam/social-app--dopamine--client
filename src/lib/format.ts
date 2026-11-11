import type { Author } from "../api/types";

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

export const displayName = (author: Author): string =>
  `${author.firstName} ${author.lastName}`.trim() || author.username;

export const initials = (author: Pick<Author, "firstName" | "lastName" | "username">): string =>
  ((author.firstName?.[0] ?? "") + (author.lastName?.[0] ?? "")).toUpperCase() ||
  author.username.slice(0, 2).toUpperCase();

/** `sub` claim of a JWT (the user id), without verifying it. */
export function tokenSubject(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return (JSON.parse(json) as { sub?: string }).sub ?? null;
  } catch {
    return null;
  }
}
