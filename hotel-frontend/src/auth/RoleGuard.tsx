import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth, type UserRole } from "./AuthContext";

/**
 * Role-based route guard component.
 *
 * Here I protect routes by checking both:
 * - Authentication status
 * - User role authorization
 *
 * If any check fails, I redirect the user
 * to the appropriate page.
 */
export default function RoleGuard({
  allowed,
  children,
}: {
  allowed: UserRole[];
  children: React.ReactNode;
}) {
  // Here I read auth state from my AuthContext
  const { user, isAuthenticated } = useAuth();

  /**
   * Here I redirect unauthenticated users to /login.
   * This prevents access without a valid session.
   */
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  /**
   * Here I redirect authenticated users without permission
   * to a dedicated /forbidden page.
   */
  if (!allowed.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  // Here I render the protected route when all checks pass
  return <>{children}</>;
}
