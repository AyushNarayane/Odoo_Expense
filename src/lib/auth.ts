export type UserRole = 'Admin' | 'Manager' | 'Employee';

export interface UserPermissions {
  role: UserRole;
  company_id?: string;
  manager_id?: string;
}

export const canAccessRoute = (userRole: UserRole, route: string): boolean => {
  const routePermissions: Record<string, UserRole[]> = {
    '/': ['Admin', 'Manager', 'Employee'],
    '/dashboard': ['Admin', 'Manager', 'Employee'],
    '/expenses/new': ['Admin', 'Manager', 'Employee'],
    '/manager/dashboard': ['Admin', 'Manager'],
    '/admin/users': ['Admin'],
    '/admin/flows': ['Admin'],
  };

  const allowedRoles = routePermissions[route] || [];
  return allowedRoles.includes(userRole);
};

export const getDefaultRoute = (userRole: UserRole): string => {
  switch (userRole) {
    case 'Admin':
      return '/admin/users';
    case 'Manager':
      return '/manager/dashboard';
    case 'Employee':
      return '/dashboard';
    default:
      return '/dashboard';
  }
};

export const getNavigationItems = (userRole: UserRole) => {
  const allItems = [
    { href: '/', label: 'Home', icon: '🏠', roles: ['Admin', 'Manager', 'Employee'] },
    { href: '/dashboard', label: 'My Expenses', icon: '📊', roles: ['Admin', 'Manager', 'Employee'] },
    { href: '/expenses/new', label: 'New Expense', icon: '➕', roles: ['Admin', 'Manager', 'Employee'] },
    { href: '/manager/dashboard', label: 'Manager Dashboard', icon: '👥', roles: ['Admin', 'Manager'] },
    { href: '/admin/users', label: 'Manage Users', icon: '👤', roles: ['Admin'] },
    { href: '/admin/flows', label: 'Approval Flows', icon: '⚙️', roles: ['Admin'] },
  ];

  return allItems.filter(item => item.roles.includes(userRole));
};
