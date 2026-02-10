import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * Here I define the user roles supported by the frontend.
 * They must match the backend roles for consistency.
 */
export type UserRole = "admin" | "receptionist";

/**
 * Here I describe the authenticated user shape that I store in memory and localStorage.
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

  /**
   * Here I expose a ready flag so routes don't redirect to /login
   * before the provider finishes loading localStorage on refresh.
   */
  isAuthReady: boolean;

  isAuthenticated: boolean;

  // Here I keep auth actions in one place to avoid scattered localStorage logic.
  login: (token: string, user: AuthUser) => void;
  logout: () => void;

  // Optional: Here I allow updating user without re-login (useful for profile edit).
  updateUser: (partial: Partial<AuthUser>) => void;
}

/**
 * Here I define a global event name so other modules (like api.ts) can request a logout
 * without importing React hooks.
 */
const FORCE_LOGOUT_EVENT = "auth:forceLogout";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  // ✅ Here I track when localStorage bootstrapping finished
  const [isAuthReady, setIsAuthReady] = useState(false);

  /**
   * Here I load persisted auth state from localStorage (if any).
   * I guard JSON.parse with try/catch so the app never crashes on corrupted data.
   */
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (savedToken) setToken(savedToken);

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        // Here I reset invalid storage to keep the app healthy.
        localStorage.removeItem("user");
        setUser(null);
      }
    }

    // ✅ Important: only after reading storage, I mark auth as ready
    setIsAuthReady(true);
  }, []);

  /**
   * Here I keep derived auth state.
   */
  const isAuthenticated = useMemo(() => Boolean(token && user), [token, user]);

  /**
   * Here I implement a single logout function that cleans everything:
   * - React state
   * - localStorage
   */
  const logoutInternal = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  /**
   *  PRO: Sync logout between browser tabs/windows.
   * If I logout in one tab, other tabs receive the storage event and logout too.
   */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // Here I react only to token/user changes.
      if (e.key === "token" || e.key === "user") {
        const t = localStorage.getItem("token");
        const u = localStorage.getItem("user");

        // If token/user were removed from another tab, I logout in this tab too.
        if (!t || !u) {
          logoutInternal();
        }
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /**
   *  PRO: Allow non-React modules (api.ts) to force logout without hooks.
   * api.ts can dispatch: window.dispatchEvent(new CustomEvent("auth:forceLogout"))
   */
  useEffect(() => {
    const onForceLogout = () => {
      logoutInternal();
    };

    window.addEventListener(FORCE_LOGOUT_EVENT, onForceLogout as any);
    return () => window.removeEventListener(FORCE_LOGOUT_EVENT, onForceLogout as any);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
      token,
      user,
      isAuthReady,
      isAuthenticated,

      login: (newToken, newUser) => {
        // Here I persist auth state so refresh keeps the session.
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem("token", newToken);
        localStorage.setItem("user", JSON.stringify(newUser));
      },

      logout: () => {
        // Here I clear auth state and storage.
        logoutInternal();
      },

      updateUser: (partial) => {
        // Here I patch the user object without requiring a full login again.
        setUser((prev) => {
          if (!prev) return prev;
          const next = { ...prev, ...partial };
          localStorage.setItem("user", JSON.stringify(next));
          return next;
        });
      },
    };
  }, [token, user, isAuthenticated, isAuthReady]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/**
 * Optional helper:
 * Here I export the event name so api.ts can dispatch it safely.
 */
export const AUTH_FORCE_LOGOUT_EVENT = FORCE_LOGOUT_EVENT;
