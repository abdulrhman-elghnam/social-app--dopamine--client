import { useEffect, useRef } from "react";
import type { Post } from "../api/types";

/**
 * In-memory pub/sub so screens stay in sync without refetching:
 * the editor emits created/updated, the detail screen emits deleted/updated (comment counts).
 */
export type PostEvent =
  | { type: "created"; post: Post }
  | { type: "updated"; post: Partial<Post> & { _id: string } }
  | { type: "deleted"; postId: string };

type Listener = (event: PostEvent) => void;
const listeners = new Set<Listener>();

export function emitPostEvent(event: PostEvent): void {
  listeners.forEach((listener) => listener(event));
}

export function usePostEvents(listener: Listener): void {
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => {
    const handler: Listener = (event) => latest.current(event);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);
}
