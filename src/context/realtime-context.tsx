import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { conversationApi } from "../api/chat";
import { notificationApi } from "../api/social";
import type { AckResponse, ClientToServerEvents, ServerToClientEvents } from "../api/socket-events";
import { refId } from "../api/types";
import { SOCKET_URL, getCredentials } from "../services/api";
import { useAuth } from "./auth-context";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

type ServerEvent = keyof ServerToClientEvents;
type ClientEvent = keyof ClientToServerEvents;
/** Payload type of a client event (its first parameter). */
type ClientPayload<E extends ClientEvent> = Parameters<ClientToServerEvents[E]>[0];
/** Data type the server acks a client event with. */
type AckData<E extends ClientEvent> = Parameters<ClientToServerEvents[E]>[1] extends
  ((response: AckResponse<infer T>) => void) | undefined
  ? T
  : unknown;

interface RealtimeContextValue {
  socket: AppSocket | null;
  connected: boolean;
  /** Emits an ack-based event; resolves with `data` or rejects with the server's localized error. */
  call: <E extends ClientEvent>(
    event: E,
    payload: ClientPayload<E>
  ) => Promise<AckData<E> | undefined>;
  unreadNotifications: number;
  setUnreadNotifications: (count: number) => void;
  /** Unread message counts per conversation id. */
  chatUnread: Record<string, number>;
  /** Conversations with at least one unread message (the Chats tab badge). */
  unreadChats: number;
  setConversationUnread: (conversationId: string, count: number) => void;
  /** The thread screen registers the conversation on screen so its messages don't count as unread. */
  setActiveConversation: (conversationId: string | null) => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const ACK_TIMEOUT_MS = 10_000;
const MAX_AUTH_RETRIES = 3;

/**
 * One Socket.IO connection per signed-in session. The handshake reads the latest stored access
 * token on every (re)connect, and an auth failure triggers a normal authed request so `apiRequest`
 * refreshes the tokens before reconnecting.
 */
export function RealtimeProvider({ children }: PropsWithChildren): ReactNode {
  const { credentials, userId } = useAuth();
  const signedIn = !!credentials;
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [chatUnread, setChatUnread] = useState<Record<string, number>>({});
  const activeConversation = useRef<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let authRetries = 0;

    const next: AppSocket = io(SOCKET_URL, {
      transports: ["websocket"],
      // Back off and eventually give up when the host has no WebSocket server (e.g. Vercel),
      // instead of reconnecting every few seconds forever and eating the rate limit.
      reconnectionAttempts: 8,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 60_000,
      auth: (cb) => {
        void getCredentials().then((stored) => cb({ token: stored?.access_token ?? "" }));
      },
    });

    next.on("connect", () => {
      authRetries = 0;
      // Published on connect (not in the effect body); no server event can arrive before this.
      setSocket(next);
      setConnected(true);
      // Counts may have changed while disconnected.
      notificationApi
        .list(1, 1)
        .then((response) => setUnreadNotifications(response.meta?.unreadCount ?? 0))
        .catch(() => undefined);
      conversationApi
        .list(1, 50)
        .then((response) => {
          const counts: Record<string, number> = {};
          for (const conversation of response.data ?? []) {
            if (conversation.unreadCount) counts[conversation._id] = conversation.unreadCount;
          }
          setChatUnread(counts);
        })
        .catch(() => undefined);
    });
    next.on("disconnect", () => setConnected(false));
    next.on("connect_error", () => {
      // Middleware rejections are not retried by socket.io; refresh the token and retry a few times.
      if (next.active || authRetries >= MAX_AUTH_RETRIES) return;
      authRetries += 1;
      notificationApi
        .list(1, 1)
        .then(() => setTimeout(() => next.connect(), 1000 * authRetries))
        .catch(() => undefined);
    });

    next.on("notification:new", ({ unreadCount }) => setUnreadNotifications(unreadCount));
    next.on("notification:read:update", ({ unreadCount }) => setUnreadNotifications(unreadCount));

    return () => {
      next.removeAllListeners();
      next.disconnect();
      setSocket(null);
      setConnected(false);
      setUnreadNotifications(0);
      setChatUnread({});
    };
  }, [signedIn]);

  // Unread chat counts follow incoming messages from other people.
  useEffect(() => {
    if (!socket) return;
    const onMessage: ServerToClientEvents["message:new"] = (message) => {
      if (refId(message.sender) === userId) return;
      if (activeConversation.current === message.conversation) return;
      setChatUnread((current) => ({
        ...current,
        [message.conversation]: (current[message.conversation] ?? 0) + 1,
      }));
    };
    socket.on("message:new", onMessage);
    return () => {
      socket.off("message:new", onMessage);
    };
  }, [socket, userId]);

  const call = useCallback(
    <E extends ClientEvent>(event: E, payload: ClientPayload<E>) =>
      new Promise<AckData<E> | undefined>((resolve, reject) => {
        if (!socket?.connected) {
          reject(new Error("You're offline. Check your connection and try again."));
          return;
        }
        // The typed overloads can't express "any event + its ack", so emit through a narrow view.
        const emitter = socket.timeout(ACK_TIMEOUT_MS) as unknown as {
          emit: (
            event: string,
            payload: unknown,
            ack: (error: Error | null, response?: AckResponse<AckData<E>>) => void
          ) => void;
        };
        emitter.emit(event, payload, (error, response) => {
          if (error || !response) reject(new Error("The server didn't respond. Try again."));
          else if (response.ok) resolve(response.data);
          else reject(new Error(response.error));
        });
      }),
    [socket]
  );

  const setConversationUnread = useCallback((conversationId: string, count: number) => {
    setChatUnread((current) => {
      if ((current[conversationId] ?? 0) === count) return current;
      const next = { ...current };
      if (count > 0) next[conversationId] = count;
      else delete next[conversationId];
      return next;
    });
  }, []);

  const setActiveConversation = useCallback((conversationId: string | null) => {
    activeConversation.current = conversationId;
  }, []);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      socket,
      connected,
      call,
      unreadNotifications,
      setUnreadNotifications,
      chatUnread,
      unreadChats: Object.values(chatUnread).filter((count) => count > 0).length,
      setConversationUnread,
      setActiveConversation,
    }),
    [
      socket,
      connected,
      call,
      unreadNotifications,
      chatUnread,
      setConversationUnread,
      setActiveConversation,
    ]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const value = useContext(RealtimeContext);
  if (!value) throw new Error("useRealtime must be used within RealtimeProvider");
  return value;
}

/** Subscribes to a server event for the lifetime of the component; the handler may change freely. */
export function useSocketEvent<E extends ServerEvent>(
  event: E,
  handler: ServerToClientEvents[E]
): void {
  const { socket } = useRealtime();
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    if (!socket) return;
    const listener = ((...args: unknown[]) =>
      (latest.current as (...a: unknown[]) => void)(...args)) as ServerToClientEvents[E];
    // Same overload limitation as `call`: subscribe through an untyped view, typed at the hook boundary.
    const target = socket as unknown as {
      on: (event: string, listener: unknown) => void;
      off: (event: string, listener: unknown) => void;
    };
    target.on(event, listener);
    return () => target.off(event, listener);
  }, [socket, event]);
}
