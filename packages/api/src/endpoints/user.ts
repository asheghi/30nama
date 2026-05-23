import type { ApiClient } from "../client.ts";

export interface User {
  user_session: string;
  user_id: number;
  user_name: string;
  user_type: string;
  user_allowed_to_download: boolean;
  user_allowed_to_stream: boolean;
  user_email?: string;
  user_mobile?: string;
  user_expire?: { days: number; g: string; j: string };
  user_avatar: string;
  is_new_user: boolean;
  is_abroad_user: boolean;
  is_admin: boolean;
}

/** Returns the current session's user; throws on invalid/expired token. */
export function getUser(client: ApiClient): Promise<User> {
  return client.call<User>("user");
}

export function logout(client: ApiClient): Promise<null> {
  return client.call<null>("logout");
}
