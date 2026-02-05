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
  name: string;
  email: string;
  role: UserRole;
}

/**
 * Internal auth state structure.
 */
interface AuthState {
  token: string | null;
  user: AuthUser | null;
}

/**
 * Public context API exposed to the app.
 */
interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  login: (payload: { token: string; user: AuthUser }) => void;
  logout: () => void;
}

/**
 * Here I create the authentication context.
 * It will be shared across the entire application.
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Keys used for persistence in localStorage
const STORAGE_TOKEN = "token";
const STORAGE_USER = "user";

/**
 * AuthProvider component.
 *
 * Here I centralize authentication state and logic
 * and make it available to all child components.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  /**
   * Here I initialize the token from localStorage (if present),
   * so sessions survive page reloads.
   */
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_TOKEN)
  );

  /**
   * Here I initialize the user from localStorage (if present).
   */
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(STORAGE_USER);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });

  /**
   * Here I keep the token synchronized with localStorage.
   */
  useEffect(() => {
    if (token) localStorage.setItem(STORAGE_TOKEN, token);
    else localStorage.removeItem(STORAGE_TOKEN);
  }, [token]);

  /**
   * Here I keep the user object synchronized with localStorage.
   */
  useEffect(() => {
    if (user) localStorage.setItem(STORAGE_USER, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_USER);
  }, [user]);

  /**
   * Here I memoize the context value to avoid unnecessary re-renders.
   */
  const value = useMemo<AuthContextValue>(() => {
    return {
      token,
      user,

      // Here I consider the user authenticated only if both token and user exist
      isAuthenticated: !!token && !!user,

      /**
       * Here I store credentials after a successful login.
       */
      login: ({ token, user }) => {
        setToken(token);
        setUser(user);
      },

      /**
       * Here I clear all auth data on logout.
       */
      logout: () => {
        setToken(null);
        setUser(null);
      },
    };
  }, [token, user]);

  // Here I expose the auth context to the whole app
  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

/**
 * Custom hook to consume the AuthContext safely.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);

  // Here I enforce that useAuth is used only inside AuthProvider
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }

  return ctx;
}
