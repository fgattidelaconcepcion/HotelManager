import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type UserRole } from "../auth/AuthContext";

/**
 * Generic protected route component.
 *
 * Here I protect routes by requiring authentication,
 * and optionally by enforcing role-based access.
 */
export default function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}) {
  /**
   * Here I read authentication state and user info from AuthContext.
   * isAuthReady prevents redirecting too early on refresh.
   */
  const { isAuthenticated, user, isAuthReady } = useAuth();

  // Here I store the current location to support redirect after login.
  const location = useLocation();

  /**
   * Here I wait until auth bootstrapping is done.
   * This avoids the "refresh => goes to login" bug.
   */
  if (!isAuthReady) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-sm text-slate-500">
        Loading session...
      </div>
    );
  }

  /**
   * Here I redirect unauthenticated users to /login
   * and preserve the original destination.
   */
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  /**
   * Here I guard against edge cases:
   * If I'm authenticated but user is still null, I redirect to login.
   */
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  /**
   * Here I optionally enforce role-based access.
   * If allowedRoles is provided, only those roles can enter.
   */
  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  // Here I render the protected content when all checks pass.
  return <>{children}</>;
}
