import { supabase } from './supabase';

/**
 * DEPRECATED: Cookie-based auth is removed.
 * Use the useAuth() hook for session data.
 */
export function getAuthToken(): string | null {
    return null;
}

export async function clearAuthToken() {
    if (typeof window !== 'undefined') {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('[AUTH DEBUG] signOut error:', error);
        
        // Final cleanup of any runaway cookies
        document.cookie = 'token=; Max-Age=0; path=/;';
        document.cookie = 'user_session=; Max-Age=0; path=/;';
        
        // Force redirect to login
        window.location.href = '/login';
    }
}

export function getUserFromToken(): null {
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
