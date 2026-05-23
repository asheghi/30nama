import type { ApiClient } from "../client.ts";

/**
 * Password login. Almost always requires a reCAPTCHA token from a real
 * browser session on 30nama.com — captcha policy is enforced server-side
 * via the c-api-key + IP signals. Prefer qrLogin for UI flows.
 */
export function login(
  client: ApiClient,
  userLogin: string,
  userPassword: string,
  recaptchaResponse?: string,
): Promise<{ token: string }> {
  return client.call<{ token: string }>("login", {
    user_login: userLogin,
    user_password: userPassword,
    recaptcha_response: recaptchaResponse,
  });
}

/** Returns whether captcha is required for the current session/IP. */
export function getCaptchaRequirement(
  client: ApiClient,
): Promise<{ captcha: boolean }> {
  return client.call<{ captcha: boolean }>("captcha");
}

/** Send OTP code to the given email or mobile number. */
export function sendOtp(
  client: ApiClient,
  userLogin: string,
  recaptchaResponse?: string,
): Promise<{ user_id: number; resend: number; valid: number }> {
  return client.call("otp", {
    user_login: userLogin,
    recaptcha_response: recaptchaResponse,
  });
}

/** Verify OTP and exchange for a session token. */
export function verifyOtp(
  client: ApiClient,
  userLogin: string,
  userCode: string,
): Promise<{ token: string }> {
  return client.call<{ token: string }>("otp_verify", {
    user_login: userLogin,
    user_code: userCode,
  });
}
