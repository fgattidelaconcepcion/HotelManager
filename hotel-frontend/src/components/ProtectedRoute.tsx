import React from "react";
import { Navigate } from "react-router-dom";
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
   *  Since we decided that login should ALWAYS go to the dashboard,
   * I don't need to store a "from" location anymore.
   */
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}
