import * as SecureStore from "expo-secure-store";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:9090";
/** Socket.IO host. Defaults to the API host, but Vercel can't run WebSockets, so point this at a long-running server. */
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? API_BASE_URL;

const CREDENTIALS_KEY = "credentials";

export interface Credentials {
  access_token: string;
  refresh_token: string;
}

export interface PageMeta {
  totalDocuments: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface ApiResponse<T = unknown, M = PageMeta> {
  message?: string;
  data?: T;
  meta?: M;
}

/** Error thrown for any non-2xx response; `message` is the server's localized text. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const errorMessage = (error: unknown, fallback = "Something went wrong"): string =>
  error instanceof Error && error.message ? error.message : fallback;

// ---- credential storage ------------------------------------------------------------------------

export async function getCredentials(): Promise<Credentials | null> {
  const value = await SecureStore.getItemAsync(CREDENTIALS_KEY);
  return value ? (JSON.parse(value) as Credentials) : null;
}

export async function saveCredentials(credentials: Credentials): Promise<void> {
  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(credentials));
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
}

// ---- session events (wired up by AuthProvider) -------------------------------------------------

type SessionListener = {
  onRefreshed: (credentials: Credentials) => void;
  onExpired: () => void;
};
let sessionListener: SessionListener | null = null;

export function setSessionListener(listener: SessionListener | null): void {
  sessionListener = listener;
}

// ---- requests ----------------------------------------------------------------------------------

interface RequestOptions extends Omit<RequestInit, "body"> {
  /** Plain objects are JSON-encoded; FormData is sent as multipart. */
  body?: unknown;
  /** Attach the access token (and refresh it once on 401). */
  auth?: boolean;
}

async function send(
  path: string,
  options: RequestOptions,
  accessToken?: string
): Promise<Response> {
  const { body, auth: _auth, ...init } = options;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  return fetch(`${API_BASE_URL}${path}`, { ...init, headers, body: payload });
}

async function parse<T, M = PageMeta>(response: Response): Promise<ApiResponse<T, M>> {
  const json = (await response.json().catch(() => ({}))) as ApiResponse<T, M> & {
    errorMessage?: string;
    error?: string;
  };
  if (!response.ok) {
    throw new ApiError(
      json.errorMessage ?? json.message ?? json.error ?? "Request failed",
      response.status
    );
  }
  return json;
}

// Concurrent 401s share one refresh attempt.
let refreshing: Promise<Credentials | null> | null = null;

async function refreshCredentials(current: Credentials): Promise<Credentials | null> {
  refreshing ??= (async () => {
    try {
      const response = await send("/auth/refresh", {
        method: "POST",
        body: { refreshToken: current.refresh_token },
      });
      const { data } = await parse<Credentials>(response);
      if (!data) return null;
      await saveCredentials(data);
      sessionListener?.onRefreshed(data);
      return data;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function apiRequest<T, M = PageMeta>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T, M>> {
  if (!options.auth) return parse<T, M>(await send(path, options));

  const credentials = await getCredentials();
  if (!credentials) {
    sessionListener?.onExpired();
    throw new ApiError("Please sign in again", 401);
  }

  let response = await send(path, options, credentials.access_token);
  if (response.status === 401) {
    const renewed = await refreshCredentials(credentials);
    if (!renewed) {
      await clearCredentials();
      sessionListener?.onExpired();
      throw new ApiError("Your session has expired. Please sign in again.", 401);
    }
    response = await send(path, options, renewed.access_token);
  }
  return parse<T, M>(response);
}

/**
 * Absolute URL for a server-relative file path such as `assets/avatars/x.png`.
 * Full URLs and local URIs (an image picked but not uploaded yet) pass through unchanged.
 */
export const fileUrl = (path?: string | null): string | undefined =>
  path
    ? /^(https?|file|content|blob|data|ph):/.test(path)
      ? path
      : `${API_BASE_URL}/${path.replace(/^\//, "")}`
    : undefined;
