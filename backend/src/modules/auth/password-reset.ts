import { createHmac, randomInt, timingSafeEqual } from 'crypto';

export const PASSWORD_RESET_OTP_TTL_MS = 15 * 60 * 1000;
export const PASSWORD_RESET_MAX_ATTEMPTS = 5;

export function createPasswordResetOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashPasswordResetOtp(otp: string, secret: string) {
  return createHmac('sha256', secret).update(otp.trim()).digest('hex');
}

export function passwordResetOtpsMatch(otp: string, hash: string, secret: string) {
  const expected = Buffer.from(hashPasswordResetOtp(otp, secret), 'hex');
  const actual = Buffer.from(hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
