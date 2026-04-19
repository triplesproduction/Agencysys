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
    if (!role) return 'EMPLOYEE';
    const r = role.toUpperCase();
    if (r.includes('ADMIN')) return 'ADMIN';
    if (r.includes('MANAGER')) return 'MANAGER';
    return 'EMPLOYEE';
}

export function hasPermission(role: string | undefined, action: Action): boolean {
    const resolvedRole = getResolvedRole(role);
    const permissions = RolePermissions[resolvedRole] || [];
    return permissions.includes(action);
}

export function canAccessPath(role: string | undefined, path: string): boolean {
    const resolvedRole = getResolvedRole(role);

    // Admin has access to everything
    if (resolvedRole === 'ADMIN') return true;

    // Restrictions for Manager/Employee
    if (path.startsWith('/employees') || path.startsWith('/logs/system') || path.startsWith('/permissions')) {
        return false;
    }

    if (path.startsWith('/leaves/approvals') || path.startsWith('/eod/reviews')) {
        return resolvedRole === 'MANAGER';
    }


    return true; // Default access for common routes like /dashboard, /tasks (viewing), etc.
}
