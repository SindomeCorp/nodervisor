import { ServiceError } from '../services/errors.js';
import { ROLE_ADMIN, ROLE_NONE, resolveUserRole, userHasRole } from '../shared/roles.js';

/** @typedef {import('./types.js').RequestSession} RequestSession */
/** @typedef {import('./types.js').User} User */
/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */

/**
 * Returns the authenticated user attached to the session.
 *
 * @param {RequestSession | undefined | null} session
 * @returns {User | null}
 */
export function getSessionUser(session) {
  return session?.user ?? null;
}

/**
 * Determines whether the provided session represents an authenticated user.
 *
 * @param {RequestSession | undefined | null} session
 * @returns {session is RequestSession & { loggedIn: true; user: User }}
 */
export function isSessionAuthenticated(session) {
  return Boolean(session?.loggedIn && session?.user);
}

/**
 * Determines whether the session user has the Administrator role.
 *
 * @param {RequestSession | undefined | null} session
 * @returns {boolean}
 */
export function isSessionAdmin(session) {
  return sessionHasRole(session, [ROLE_ADMIN]);
}

/**
 * Determines whether the session user has one of the specified roles.
 *
 * @param {RequestSession | undefined | null} session
 * @param {string[]} roles
 * @returns {boolean}
 */
export function sessionHasRole(session, roles) {
  if (!isSessionAuthenticated(session)) {
    return false;
  }

  if (!Array.isArray(roles) || roles.length === 0) {
    return false;
  }

  return userHasRole(getSessionUser(session), roles);
}

/**
 * Ensures the current request is authenticated. Returns true when the caller
 * should proceed, false when a redirect response has already been sent.
 *
 * @param {Request & { session?: RequestSession }} req
 * @param {Response} res
 * @param {string} [redirectTo='/login']
 * @returns {boolean}
 */
export function ensureAuthenticatedRequest(req, res, redirectTo = '/auth/login') {
  if (!isSessionAuthenticated(req.session)) {
    res.redirect(redirectTo);
    return false;
  }

  return true;
}

/**
 * Ensures the current request belongs to a user with one of the allowed roles.
 * The return value mirrors {@link ensureAuthenticatedRequest}.
 *
 * @param {Request & { session?: RequestSession }} req
 * @param {Response} res
 * @param {string[]} roles
 * @param {string} [redirectTo='/request-access']
 * @returns {boolean}
 */
export function ensureRoleRequest(req, res, roles, redirectTo = '/request-access') {
  if (!ensureAuthenticatedRequest(req, res)) {
    return false;
  }

  if (!sessionHasRole(req.session, roles)) {
    const userRole = resolveUserRole(getSessionUser(req.session));
    const fallback = userRole === ROLE_NONE ? redirectTo : '/dashboard';
    res.redirect(fallback);
    return false;
  }

  return true;
}

/**
 * Ensures the current request belongs to an authenticated administrator. The
 * return value mirrors {@link ensureAuthenticatedRequest}.
 *
 * @param {Request & { session?: RequestSession }} req
 * @param {Response} res
 * @param {string} [redirectTo='/dashboard']
 * @returns {boolean}
 */
export function ensureAdminRequest(req, res, redirectTo = '/request-access') {
  return ensureRoleRequest(req, res, [ROLE_ADMIN], redirectTo);
}

/**
 * Asserts that a session is authenticated, throwing a {@link ServiceError}
 * when it is not. This is primarily useful for JSON API handlers where
 * redirects are undesirable.
 *
 * @param {RequestSession | undefined | null} session
 * @returns {RequestSession & { loggedIn: true; user: User }}
 * @throws {ServiceError}
 */
export function assertSessionAuthenticated(session) {
  if (!isSessionAuthenticated(session)) {
    throw new ServiceError('Not authenticated', 401);
  }

  return session;
}

/**
 * Asserts that the current session user has one of the specified roles.
 *
 * @param {RequestSession | undefined | null} session
 * @param {string[]} roles
 * @returns {RequestSession & { loggedIn: true; user: User }}
 * @throws {ServiceError}
 */
export function assertSessionRole(session, roles) {
  const authenticatedSession = assertSessionAuthenticated(session);

  if (!Array.isArray(roles) || roles.length === 0) {
    throw new ServiceError('Insufficient privileges', 403);
  }

  if (!sessionHasRole(authenticatedSession, roles)) {
    throw new ServiceError('Insufficient privileges', 403);
  }

  return authenticatedSession;
}

/**
 * Asserts that the current session user is an administrator. Throws a
 * {@link ServiceError} when the requirement is not satisfied.
 *
 * @param {RequestSession | undefined | null} session
 * @returns {RequestSession & { loggedIn: true; user: User }}
 * @throws {ServiceError}
 */
export function assertSessionAdmin(session) {
  return assertSessionRole(session, [ROLE_ADMIN]);
}
