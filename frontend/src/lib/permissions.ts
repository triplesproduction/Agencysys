export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export type Action =
  | 'VIEW_DASHBOARD'
  | 'MANAGE_EMPLOYEES'
  | 'CREATE_TASKS'
  | 'EDIT_TASKS'
  | 'DELETE_TASKS'
  | 'VIEW_ALL_TASKS'
  | 'APPROVE_LEAVES'
  | 'VIEW_REPORTS'
  | 'SEND_BROADCAST';

const RolePermissions: Record<Role, Action[]> = {
    ADMIN: [
        'VIEW_DASHBOARD',
        'MANAGE_EMPLOYEES',
        'CREATE_TASKS',
        'EDIT_TASKS',
        'DELETE_TASKS',
        'VIEW_ALL_TASKS',
        'APPROVE_LEAVES',
        'VIEW_REPORTS',
        'SEND_BROADCAST'
    ],
    MANAGER: [
        'VIEW_DASHBOARD',
        'CREATE_TASKS',
        'EDIT_TASKS',
        'VIEW_ALL_TASKS',
        'APPROVE_LEAVES',
        'VIEW_REPORTS'
    ],
    EMPLOYEE: [
        'VIEW_DASHBOARD'
    ]
};

export function getResolvedRole(role: string | undefined): Role {
    return (role as Role) || 'EMPLOYEE';
}

export function hasPermission(role: string | undefined, action: Action): boolean {
    const resolvedRole = getResolvedRole(role);
    const permissions = RolePermissions[resolvedRole] || [];
    return permissions.includes(action);
}

// ── Allowed paths per role (deny-by-default architecture) ─────────────────────
// All roles must be explicitly listed. Any unlisted path is DENIED.
// Prefix matching: a path prefix in this list allows that path and all sub-paths.
const ALLOWED_PATH_PREFIXES: Record<Role, string[]> = {
    ADMIN: [
        // Admin has access to all application routes.
        // We return true unconditionally for ADMIN below.
        '/',
    ],
    MANAGER: [
        '/dashboard',
        '/tasks',
        '/projects',
        '/attendance',
        '/messaging',
        '/notes',
        '/boards',
        '/kpis',
        '/leaves',           // includes /leaves/approvals for manager
        '/eod',              // includes /eod/reviews for manager
        '/broadcast',
        '/rulebook',
        '/logs'
    ],
    EMPLOYEE: [
        '/dashboard',
        '/tasks',
        '/projects',
        '/attendance',
        '/messaging',
        '/notes',
        '/boards',
        '/kpis',
        '/leaves',           // own leaves only — data scoping enforced by RLS + page logic
        '/eod',              // own EOD submissions only
        '/broadcast',
        '/rulebook',
        '/logs'
    ],
};

/**
 * Determines whether a given role is allowed to access a path.
 *
 * Architecture: DENY by default.
 * Only paths explicitly listed in ALLOWED_PATH_PREFIXES are accessible.
 * This is the client-side guard (AuthGuard). Server-side RBAC is enforced separately in middleware.ts.
 */
export function canAccessPath(role: string | undefined, path: string): boolean {
    const resolvedRole = getResolvedRole(role);

    // Admin has unrestricted access.
    if (resolvedRole === 'ADMIN') return true;

    const allowedPrefixes = ALLOWED_PATH_PREFIXES[resolvedRole] || [];

    // Check if the requested path starts with any of the role's allowed prefixes.
    return allowedPrefixes.some(prefix => path.startsWith(prefix));
}
