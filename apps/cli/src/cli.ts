#!/usr/bin/env node
import { Command } from "commander";
import {
  ApiClient,
  ApiError,
  createDirectTransport,
  extractId,
  getDownload,
  type Download,
} from "@30nama/api";
import { qrLogin } from "./login-qr.ts";
import {
  clearSession,
  loadSession,
  saveSession,
  sessionPath,
  type Session,
} from "./session.ts";

const program = new Command();

program
  .name("30nama")
  .description("CLI for 30nama — scrape direct download URLs")
  .version("0.2.0");

program
  .command("login")
  .description("Sign in by opening a QR-login URL on your phone")
  .option("--token <token>", "skip QR; save a token you already have")
  .action(async (opts: { token?: string }) => {
    if (opts.token) {
      await saveSession({
        token: opts.token,
        savedAt: new Date().toISOString(),
      });
      console.log(`Token saved to ${sessionPath()}.`);
      return;
    }

    const { token, user } = await qrLogin();
    await saveSession({
      token,
      userId: user.user_id,
      userEmail: user.user_email,
      userName: user.user_name,
      userType: user.user_type,
      savedAt: new Date().toISOString(),
    });
    console.log("");
    console.log(
      `Logged in as ${user.user_email ?? user.user_name} (${user.user_type}).`,
    );
    console.log(`Session written to ${sessionPath()}.`);
  });

program
  .command("whoami")
  .description("Print stored session info")
  .action(async () => {
    const s: Session | null = await loadSession();
    if (!s) {
      console.log("No session. Run `30nama login`.");
      process.exit(1);
    }
    console.log(JSON.stringify(s, null, 2));
  });

program
  .command("logout")
  .description("Delete the saved session")
  .action(async () => {
    await clearSession();
    console.log("Session cleared.");
  });

program
  .command("downloads <urlOrId>")
  .description("Fetch direct download URLs for a movie or series")
  .option("--json", "print the raw JSON response")
  .option(
    "--quality <substr>",
    "filter quality groups (e.g. 1080p, 720p, x265)",
  )
  .option("--episode <n>", "filter to a single episode number")
  .option("--season <n>", "filter to a single season number")
  .action(async (urlOrId: string, opts: DownloadOpts) => {
    const session = await loadSession();
    if (!session) die("Not logged in. Run `30nama login`.");

    const id = extractId(urlOrId);
    const client = new ApiClient(createDirectTransport(), {
      token: session.token,
    });
    const result = await getDownload(client, id);

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const groups = flattenDownloads(result.download);
    const filtered = filterGroups(groups, opts);
    if (filtered.length === 0) {
      console.log("No matching download groups.");
      return;
    }

    for (const g of filtered) {
      printGroup(g);
    }
  });

interface DownloadOpts {
  json?: boolean;
  quality?: string;
  season?: string;
  episode?: string;
}

function flattenDownloads(
  download: Record<string, Download[]> | Download[] | undefined,
): Download[] {
  if (!download) return [];
  if (Array.isArray(download)) return download;
  return Object.values(download).flat();
}

function filterGroups(groups: Download[], opts: DownloadOpts): Download[] {
  const qNeedle = opts.quality?.toLowerCase();
  const seasonFilter = opts.season ? Number(opts.season) : null;
  const episodeFilter = opts.episode ? Number(opts.episode) : null;

  return groups
    .filter((g) => !qNeedle || g.quality.toLowerCase().includes(qNeedle))
    .filter(
      (g) =>
        seasonFilter === null ||
        g.season_int === seasonFilter ||
        g.season === seasonFilter,
    )
    .map((g) =>
      episodeFilter === null
        ? g
        : { ...g, link: g.link.filter((l) => l.episode === episodeFilter) },
    )
    .filter((g) => g.link.length > 0);
}

function printGroup(g: Download): void {
  const tagBits = [g.encoder, g.size, g.tags.join(" / ")]
    .filter(Boolean)
    .join(" · ");
  const seasonLabel = g.season_int ?? g.season;
  const epCount = g.total_episode ?? g.link.length;
  console.log(
    `\nS${seasonLabel ?? "?"} — ${g.quality.trim()} (${tagBits}) — ${epCount} ep`,
  );
  for (const l of g.link) {
    console.log(`  E${String(l.episode).padStart(2, "0")}  ${l.dl}`);
  }
}

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

program.parseAsync(process.argv).catch((err) => {
  if (err instanceof ApiError) {
    console.error(`API error (${err.status}): ${err.message}`);
    if (process.env.DEBUG) console.error(err.body);
  } else {
    console.error(err instanceof Error ? err.message : err);
  }
  process.exit(1);
});
