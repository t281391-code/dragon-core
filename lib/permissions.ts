export const ROLES = {
  ADMIN: "ADMIN",
  MODERATOR: "MODERATOR",
  USER: "USER"
} as const;

export const DEPARTMENTS = {
  WAREHOUSE: "WAREHOUSE",
  PRODUCTION: "PRODUCTION",
  SAFETY: "SAFETY",
  LOGISTICS: "LOGISTICS"
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];
export type DepartmentName = (typeof DEPARTMENTS)[keyof typeof DEPARTMENTS];

export type PermissionUser = {
  role: RoleName;
  department: DepartmentName;
  isActive: boolean;
};

export function isAdmin(user: PermissionUser) {
  return user.isActive && user.role === ROLES.ADMIN;
}

export function hasRole(user: PermissionUser, allowedRoles: RoleName[]) {
  return user.isActive && allowedRoles.includes(user.role);
}

export function belongsToDepartment(
  user: PermissionUser,
  department: DepartmentName
) {
  return user.isActive && user.department === department;
}

export function canAccessDepartment(
  user: PermissionUser,
  department: DepartmentName
) {
  if (!user.isActive) {
    return false;
  }

  if (user.role === ROLES.ADMIN) {
    return true;
  }

  return user.department === department;
}

export const DEPARTMENT_ROUTE_ACCESS = {
  warehouse: DEPARTMENTS.WAREHOUSE,
  production: DEPARTMENTS.PRODUCTION,
  safety: DEPARTMENTS.SAFETY,
  logistics: DEPARTMENTS.LOGISTICS
} as const;
