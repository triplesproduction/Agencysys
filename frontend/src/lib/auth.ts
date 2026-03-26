export function getAuthToken(): string | null {
    return null;
}

export function setAuthToken(token: string) {
    // Session is handled by Next.js Server Route HttpOnly Cookie securely
}

export function clearAuthToken() {
    if (typeof window !== 'undefined') {
        fetch('/api/auth/logout', { method: 'POST' }).then(() => {
            window.location.href = '/login';
        });
    }
}

export function getUserFromToken(): { sub?: string, role?: string, employeeId?: string, roleId?: string, id?: string } | null {
    if (typeof window !== 'undefined') {
        const match = document.cookie.match(new RegExp('(^| )user_session=([^;]+)'));
        if (match) {
            try { return JSON.parse(decodeURIComponent(match[2])); } catch { return null; }
        }
    }
    return null;
}

export function checkPermission(requiredRole: string | string[], userRole?: string): boolean {
    if (!userRole) return false;

    const normalizedUserRole = userRole.toUpperCase();

    if (Array.isArray(requiredRole)) {
        return requiredRole.map(r => r.toUpperCase()).includes(normalizedUserRole);
    }

    return requiredRole.toUpperCase() === normalizedUserRole;
}
