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

export function hasPermission(role: string | undefined, action: Action): boolean {
    if (!role) return false;
    const normalizedRole = role.toUpperCase() as Role;
    const permissions = RolePermissions[normalizedRole] || [];
    return permissions.includes(action);
}

export function canAccessPath(role: string | undefined, path: string): boolean {
    if (!role) return false;
    const normalizedRole = role.toUpperCase();

    // Admin has access to everything
    if (normalizedRole === 'ADMIN') return true;

    // Restrictions for Manager/Employee
    if (path.startsWith('/employees') || path.startsWith('/logs/system') || path.startsWith('/permissions')) {
        return normalizedRole === 'ADMIN';
    }

    if (path.startsWith('/leaves/approvals') || path.startsWith('/eod/reviews')) {
        return normalizedRole === 'ADMIN' || normalizedRole === 'MANAGER';
    }

    if (path.startsWith('/messaging/broadcast')) {
        return normalizedRole === 'ADMIN';
    }

    return true; // Default access for common routes like /dashboard, /tasks (viewing), etc.
}
