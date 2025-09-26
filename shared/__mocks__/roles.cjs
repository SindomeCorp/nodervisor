module.exports = {
  ROLE_ADMIN: 'admin',
  ROLE_MANAGER: 'manager',
  ROLE_NONE: 'none',
  ROLE_VIEWER: 'viewer',
  resolveUserRole: (user) => (user && user.role) || 'none',
  userHasRole: (user, allowed) => allowed.includes((user && user.role) || 'none')
};
