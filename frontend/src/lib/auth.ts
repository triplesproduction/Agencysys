import { supabase } from './supabase';

// No-op: Supabase manages the session automatically
export function getAuthToken(): string | null {
    return null;
}

// No-op: kept for backwards compatibility — cookie is written directly in login page
export function setAuthToken(_token: string) {}

export async function clearAuthToken() {
    if (typeof window !== 'undefined') {
        await supabase.auth.signOut();
        document.cookie = 'token=; Max-Age=0; path=/;';
        document.cookie = 'user_session=; Max-Age=0; path=/;';
        window.location.href = '/login';
    }
}

/**
 * Reads the user_session cookie written at login.
 * Returns id, roleId, role, firstName, lastName, sub.
 */
export function getUserFromToken(): {
    sub?: string;
    role?: string;
    employeeId?: string;
    roleId?: string;
    id?: string;
    firstName?: string;
    lastName?: string;
} | null {
    if (typeof window !== 'undefined') {
        const match = document.cookie.match(/(^| )user_session=([^;]+)/);
        if (match) {
            try {
                return JSON.parse(decodeURIComponent(match[2]));
            } catch {
                return null;
            }
        }
    }
    return null;
}

export function checkPermission(requiredRole: string | string[], userRole?: string): boolean {
    if (!userRole) return false;
    const normalized = userRole.toUpperCase();
    if (Array.isArray(requiredRole)) {
        return requiredRole.map(r => r.toUpperCase()).includes(normalized);
    }
    return requiredRole.toUpperCase() === normalized;
}
