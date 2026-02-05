import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type UserRole } from "../auth/AuthContext";

/**
 * Role-based protected route component.
 *
 * Here I restrict access to routes based on authentication
 * and user roles on the frontend.
 */
export default function RoleRoute({
  children,
  allowed,
}: {
  children: React.ReactNode;
  allowed: UserRole[];
}) {
  // Here I get authentication state and user info from my AuthContext
  const { isAuthenticated, user } = useAuth();

  // Here I store the current location for redirect after login
  const location = useLocation();

  /**
   * Here I redirect unauthenticated users to /login.
   * I also preserve the original route so they can come back after login.
   */
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  /**
   * Here I block access if the user is logged in
   * but does not have the required role.
   */
  if (!user || !allowed.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  // Here I render the protected content if all checks pass
  return <>{children}</>;
}
