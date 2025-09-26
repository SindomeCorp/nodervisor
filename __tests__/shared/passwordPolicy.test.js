import { describe, expect, it } from '@jest/globals';

import {
  PASSWORD_MIN_LENGTH,
  checkPasswordAgainstPolicy,
  isPasswordCompliant
} from '../../shared/passwordPolicy.js';

describe('password policy helpers', () => {
  it('identifies weak passwords and reports the first error', () => {
    const errors = checkPasswordAgainstPolicy('weakpass');

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(new RegExp(`${PASSWORD_MIN_LENGTH}`));
    expect(isPasswordCompliant('weakpass')).toBe(false);
  });

  it('accepts passwords that meet every requirement', () => {
    const password = 'ValidPass123!';

    expect(checkPasswordAgainstPolicy(password)).toEqual([]);
    expect(isPasswordCompliant(password)).toBe(true);
  });
});
