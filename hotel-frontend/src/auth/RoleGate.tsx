import type React from "react";
import { useAuth, type UserRole } from "./AuthContext";

/**
 * Role-based UI guard component.
 *
 * Here I conditionally render UI elements
 * based on the authenticated user's role.
 *
 * Unlike route guards, this is used inside pages
 * to hide/show specific components or actions.
 */
export default function RoleGate({
  allowed,
  children,
  fallback = null,
}: {
  allowed: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  // Here I get the current user from AuthContext
  const { user } = useAuth();

  /**
   * Here I hide the content if:
   * - The user is not logged in
   * - The user's role is not allowed
   */
  if (!user) return fallback;
  if (!allowed.includes(user.role)) return fallback;

  // Here I render the protected UI when access is allowed
  return <>{children}</>;
}
