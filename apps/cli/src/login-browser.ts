import { chromium, type Browser } from "playwright";
import type { LoginResult } from "@30nama/api";

const LOGIN_URL = "https://30nama.com/login";
const LOGIN_API_PATH = "/api/v1/action/loginV2";

export async function interactiveLogin(): Promise<LoginResult> {
  console.log("Opening Chromium. Sign in on the 30nama page, solve the captcha if shown — we'll capture the token automatically.");

  const browser: Browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
  });
  const page = await context.newPage();

  const result = await new Promise<LoginResult>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    page.on("response", async (res) => {
      if (settled) return;
      if (!res.url().includes(LOGIN_API_PATH)) return;
      if (res.request().method() !== "POST") return;

      try {
        const json = (await res.json()) as {
          success?: boolean;
          msg?: string | null;
          result?: LoginResult;
        };
        if (json?.success && json.result?.usertoken) {
          settle(() => resolve(json.result as LoginResult));
        } else if (json && json.success === false) {
          console.error(`Login attempt failed: ${json.msg ?? "unknown error"}. Try again.`);
        }
      } catch {
        // ignore non-JSON or already-consumed bodies
      }
    });

    browser.on("disconnected", () => {
      settle(() => reject(new Error("Browser closed before login completed.")));
    });

    page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" }).catch((err) => {
      settle(() => reject(err));
    });
  });

  await browser.close().catch(() => {});
  return result;
}
