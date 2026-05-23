import { setTimeout as sleep } from "node:timers/promises";
import {
  ApiClient,
  ApiError,
  createDirectTransport,
  qrLoginCode,
  qrLoginLogin,
  getUser,
  type User,
} from "@30nama/api";

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 5 * 60_000;

export interface QrLoginResult {
  token: string;
  user: User;
}

/**
 * Print a QR-login URL, poll until the user confirms on a logged-in device,
 * then fetch the user profile that goes with the resulting token.
 */
export async function qrLogin(): Promise<QrLoginResult> {
  const client = new ApiClient(createDirectTransport());

  const { code, url } = await qrLoginCode(client);

  console.log("");
  console.log("Open this URL on your phone (signed in to 30nama):");
  console.log("");
  console.log(`  ${url}`);
  console.log("");
  console.log("Waiting for confirmation… (Ctrl+C to abort)");

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let token: string | null = null;
  while (Date.now() < deadline) {
    try {
      const res = await qrLoginLogin(client, code);
      token = res.token;
      break;
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      // Server returns success:false until the user confirms. Keep polling.
    }
    await sleep(POLL_INTERVAL_MS);
  }

  if (!token) {
    throw new Error("QR login timed out. Run `30nama login` again.");
  }

  client.setToken(token);
  const user = await getUser(client);
  return { token, user };
}
