import type React from "react";
import { useAuth, type UserRole } from "./AuthContext";

/**
 * Role-based UI guard component.
 *
 * Here I conditionally render UI elements
 * based on the authenticated user's role.
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
  const { user } = useAuth();

  if (!user) return fallback;

  // Normalize roles to avoid "Admin"/"ADMIN"/"admin " issues
  const userRole = String((user as any).role ?? "")
    .trim()
    .toLowerCase();

  const allowedRoles = allowed.map((r) => String(r).trim().toLowerCase());

  if (!allowedRoles.includes(userRole)) return fallback;

  return <>{children}</>;
}
