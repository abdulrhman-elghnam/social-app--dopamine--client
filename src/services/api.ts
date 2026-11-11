import * as SecureStore from "expo-secure-store";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:9090";

export interface Credentials {
  access_token: string;
  refresh_token: string;
}

export interface ApiResponse<T = unknown> {
  message?: string;
  data?: T;
  meta?: {
    totalDocuments?: number;
    totalPages?: number;
    currentPage?: number;
    pageSize?: number;
  };
}

export async function getCredentials(): Promise<Credentials | null> {
  const value = await SecureStore.getItemAsync("credentials");
  return value ? (JSON.parse(value) as Credentials) : null;
}

export async function saveCredentials(credentials: Credentials): Promise<void> {
  await SecureStore.setItemAsync("credentials", JSON.stringify(credentials));
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync("credentials");
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  authenticated = false
): Promise<ApiResponse<T>> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (authenticated) {
    const credentials = await getCredentials();
    if (!credentials?.access_token) {
      throw new Error("Please sign in again");
    }
    headers.set("Authorization", `Bearer ${credentials.access_token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });
  const body = (await response.json().catch(() => ({}))) as ApiResponse<T> & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.message ?? body.error ?? "Request failed");
  }
  return body;
}
