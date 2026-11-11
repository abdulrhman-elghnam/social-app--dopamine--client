import { useToast } from "heroui-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { authApi } from "../api/auth";
import { userApi } from "../api/posts";
import type { UserProfile } from "../api/types";
import { tokenSubject } from "../lib/format";
import {
  clearCredentials,
  getCredentials,
  saveCredentials,
  setSessionListener,
  type Credentials,
} from "../services/api";

interface AuthContextValue {
  credentials: Credentials | null;
  /** Id of the signed-in user (JWT `sub`), used for ownership checks. */
  userId: string | null;
  profile: UserProfile | null;
  /** True until stored credentials have been read on launch. */
  loading: boolean;
  signIn: (credentials: Credentials) => Promise<void>;
  signOut: () => Promise<void>;
  reloadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren): ReactNode {
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCredentials()
      .then(setCredentials)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setSessionListener({
      onRefreshed: setCredentials,
      onExpired: () => {
        setCredentials((current) => {
          if (current) {
            toast.show({
              variant: "warning",
              label: "Session expired",
              description: "Please sign in again.",
            });
          }
          return null;
        });
        setProfile(null);
      },
    });
    return () => setSessionListener(null);
  }, [toast]);

  const reloadProfile = useCallback(async () => {
    try {
      setProfile(await userApi.profile());
    } catch {
      // Expired sessions are handled by the session listener; other failures keep the old profile.
    }
  }, []);

  useEffect(() => {
    if (!credentials) return;
    let active = true;
    userApi
      .profile()
      .then((next) => {
        if (active) setProfile(next);
      })
      .catch(() => {
        // Expired sessions are handled by the session listener.
      });
    return () => {
      active = false;
    };
  }, [credentials]);

  const value = useMemo<AuthContextValue>(
    () => ({
      credentials,
      userId: credentials ? tokenSubject(credentials.access_token) : null,
      profile,
      loading,
      reloadProfile,
      signIn: async (next) => {
        await saveCredentials(next);
        setCredentials(next);
      },
      signOut: async () => {
        // Best effort: revoke the session server-side, but sign out locally regardless.
        if (credentials) await authApi.logout(credentials.refresh_token).catch(() => undefined);
        await clearCredentials();
        setCredentials(null);
        setProfile(null);
      },
    }),
    [credentials, profile, loading, reloadProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
