import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  clearCredentials,
  getCredentials,
  saveCredentials,
  type Credentials,
} from "../services/api";

interface AuthContextValue {
  credentials: Credentials | null;
  loading: boolean;
  signIn: (credentials: Credentials) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren): ReactNode {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCredentials()
      .then(setCredentials)
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      credentials,
      loading,
      signIn: async (nextCredentials) => {
        await saveCredentials(nextCredentials);
        setCredentials(nextCredentials);
      },
      signOut: async () => {
        await clearCredentials();
        setCredentials(null);
      },
    }),
    [credentials, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
