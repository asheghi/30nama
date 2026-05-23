import type { ApiClient } from "../client.ts";

export interface QrLoginCode {
  code: string;
  /** URL to display as a QR for the user to open on their authenticated device. */
  url: string;
}

/** Step 1: request a fresh QR auth code. */
export function qrLoginCode(client: ApiClient): Promise<QrLoginCode> {
  return client.call<QrLoginCode>("qrlogin_code");
}

export interface QrLoginToken {
  token: string;
}

/**
 * Step 2: poll until the user confirms login on their device. Resolves with
 * the token once authenticated; rejects with ApiError until then.
 */
export function qrLoginLogin(
  client: ApiClient,
  code: string,
): Promise<QrLoginToken> {
  return client.call<QrLoginToken>("qrlogin_login", { auth_code: code });
}

/**
 * Called from the already-authenticated device (phone) to mark the QR auth
 * code as confirmed. Our clients don't usually call this — the user does it
 * by scanning the QR with the official app.
 */
export function qrLoginAuth(client: ApiClient, code: string): Promise<null> {
  return client.call<null>("qrlogin_auth", { auth_code: code });
}
