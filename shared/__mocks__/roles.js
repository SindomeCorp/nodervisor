export const ROLE_ADMIN = 'Admin';
export const ROLE_MANAGER = 'Manager';
export const ROLE_VIEWER = 'Viewer';
export const ROLE_NONE = 'None';
export const ALL_ROLES = [ROLE_ADMIN, ROLE_MANAGER, ROLE_VIEWER, ROLE_NONE];

export function resolveUserRole(user) {
  return typeof user?.role === 'string' ? user.role : ROLE_NONE;
}

export function userHasRole(user, allowedRoles) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return false;
  }

  const effectiveRole = resolveUserRole(user);
  return allowedRoles.includes(effectiveRole);
}
