import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface Session {
  /** Bearer token used as `c-token` on subsequent requests. */
  token: string;
  userId?: number;
  userEmail?: string;
  userName?: string;
  userType?: string;
  savedAt: string;
}

const SESSION_PATH = join(
  process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"),
  "30nama",
  "session.json",
);

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await readFile(SESSION_PATH, "utf8");
    return JSON.parse(raw) as Session;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function saveSession(session: Session): Promise<void> {
  await mkdir(dirname(SESSION_PATH), { recursive: true });
  await writeFile(SESSION_PATH, JSON.stringify(session, null, 2), {
    mode: 0o600,
  });
}

export async function clearSession(): Promise<void> {
  await rm(SESSION_PATH, { force: true });
}

export function sessionPath(): string {
  return SESSION_PATH;
}
