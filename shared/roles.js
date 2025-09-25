export const ROLE_ADMIN = 'Admin';
export const ROLE_MANAGER = 'Manager';
export const ROLE_VIEWER = 'Viewer';
export const ROLE_NONE = 'None';

export const ALL_ROLES = [ROLE_ADMIN, ROLE_MANAGER, ROLE_VIEWER, ROLE_NONE];
export const ACTIVE_ROLES = [ROLE_ADMIN, ROLE_MANAGER, ROLE_VIEWER];

/**
 * Determines whether a user object has at least one of the permitted roles.
 *
 * @param {{ role?: string | null } | null | undefined} user
 * @param {string[]} roles
 * @returns {boolean}
 */
export function userHasRole(user, roles) {
  if (!user || !Array.isArray(roles) || roles.length === 0) {
    return false;
  }

  const role = typeof user.role === 'string' ? user.role : ROLE_NONE;
  return roles.includes(role);
}

/**
 * Returns the effective role for a user, falling back to {@link ROLE_NONE}.
 *
 * @param {{ role?: string | null } | null | undefined} user
 * @returns {string}
 */
export function resolveUserRole(user) {
  return typeof user?.role === 'string' ? user.role : ROLE_NONE;
}
