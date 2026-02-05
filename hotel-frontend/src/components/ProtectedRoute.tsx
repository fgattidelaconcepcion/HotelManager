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
  // Here I read authentication state and user info from AuthContext
  const { isAuthenticated, user } = useAuth();

  // Here I store the current location to support redirect after login
  const location = useLocation();

  /**
   * Here I redirect unauthenticated users to /login
   * and preserve the original destination.
   */
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  /**
   * Here I optionally enforce role-based access.
   * If allowedRoles is provided, only those roles can enter.
   */
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  // Here I render the protected content when all checks pass
  return <>{children}</>;
}
