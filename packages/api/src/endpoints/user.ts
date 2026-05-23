import type { ApiClient } from "../client.ts";

// Permissive shape — the real response (~1.2KB) carries the signed-in user's
// profile, subscription, and avatar. Tighten once a real response is captured.
export interface User {
  id?: number;
  username?: string;
  email?: string;
  avatar?: string | null;
  [key: string]: unknown;
}

export function getUser(client: ApiClient): Promise<User> {
  return client.post<User>("/action/user", { jsonBody: {} });
}
