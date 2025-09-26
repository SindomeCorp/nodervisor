export const PASSWORD_MIN_LENGTH = 12;
const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /[0-9]/;
const SPECIAL_REGEX = /[^A-Za-z0-9]/;

export const PASSWORD_POLICY_SUMMARY =
  `Password must be at least ${PASSWORD_MIN_LENGTH} characters long and include uppercase, lowercase, number, and special character.`;

/**
 * Validates the provided password against the project's password policy.
 *
 * @param {unknown} password
 * @returns {string[]} An array of validation error messages. Empty when the password complies.
 */
export function checkPasswordAgainstPolicy(password) {
  const value = typeof password === 'string' ? password : String(password ?? '');
  const errors = [];

  if (value.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
  }
  if (!UPPERCASE_REGEX.test(value)) {
    errors.push('Password must include at least one uppercase letter.');
  }
  if (!LOWERCASE_REGEX.test(value)) {
    errors.push('Password must include at least one lowercase letter.');
  }
  if (!NUMBER_REGEX.test(value)) {
    errors.push('Password must include at least one digit.');
  }
  if (!SPECIAL_REGEX.test(value)) {
    errors.push('Password must include at least one special character.');
  }

  return errors;
}

/**
 * Determines whether the provided password complies with the policy.
 *
 * @param {unknown} password
 * @returns {boolean}
 */
export function isPasswordCompliant(password) {
  return checkPasswordAgainstPolicy(password).length === 0;
}
