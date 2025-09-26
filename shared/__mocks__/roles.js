export const ROLE_ADMIN = 'admin';
export const ROLE_MANAGER = 'manager';
export const ROLE_NONE = 'none';
export const ROLE_VIEWER = 'viewer';
export const ALL_ROLES = [ROLE_ADMIN, ROLE_MANAGER, ROLE_VIEWER, ROLE_NONE];

export function resolveUserRole(user) {
  return (user && user.role) || ROLE_NONE;
}

export function userHasRole(user, allowed) {
  const role = (user && user.role) || ROLE_NONE;
  return Array.isArray(allowed) && allowed.includes(role);
}
