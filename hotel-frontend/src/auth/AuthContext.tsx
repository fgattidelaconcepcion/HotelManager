import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Here I define the user roles supported by the frontend.
 * They must match the backend roles for consistency.
 */
export type UserRole = "admin" | "receptionist";

/**
 * Here I describe the authenticated user shape
 * that I store in memory and localStorage.
 */
export interface AuthUser {
  id: number;
  hotelId: number;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  // Here I load persisted auth state from localStorage (if any)
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (savedToken) setToken(savedToken);
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  // Here I compute derived auth state
  const isAuthenticated = useMemo(() => Boolean(token && user), [token, user]);

  const value = useMemo<AuthContextValue>(() => {
    return {
      token,
      user,
      isAuthenticated,

      login: (newToken, newUser) => {
        // Here I persist auth state so refresh keeps the session
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem("token", newToken);
        localStorage.setItem("user", JSON.stringify(newUser));
      },

      logout: () => {
        // Here I clear auth state and storage
        setToken(null);
        setUser(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      },
    };
  }, [token, user, isAuthenticated]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
