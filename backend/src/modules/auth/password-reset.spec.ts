import { createPasswordResetOtp, hashPasswordResetOtp, passwordResetOtpsMatch } from './password-reset';

describe('password-reset', () => {
  it('creates a 6-digit OTP', () => {
    expect(createPasswordResetOtp()).toMatch(/^\d{6}$/);
  });

  it('matches a hashed OTP and rejects a different code', () => {
    const secret = 'test-secret';
    const hash = hashPasswordResetOtp('424242', secret);
    expect(passwordResetOtpsMatch('424242', hash, secret)).toBe(true);
    expect(passwordResetOtpsMatch('000000', hash, secret)).toBe(false);
  });
});
