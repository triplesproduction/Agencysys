/**
 * AuthContext — Canonical export location for the global auth system.
 *
 * The full implementation lives in @/hooks/useAuth.tsx (AuthProvider + AuthContext).
 * This file re-exports everything from that module so any page or component can
 * import from '@/context/AuthContext' as the stable, documented import path.
 *
 * Usage:
 *   import { useAuth } from '@/context/AuthContext';
 *   const { user, employee, loading, signOut } = useAuth();
 */

export { AuthProvider, useAuth } from '@/hooks/useAuth';
