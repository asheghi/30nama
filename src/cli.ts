#!/usr/bin/env node
import { Command } from "commander";
import {
  extractId,
  getDownloads,
  type DownloadGroup,
  type LoginResult,
} from "./api.ts";
import { ApiError } from "./client.ts";
import { interactiveLogin } from "./login-browser.ts";
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
  .description("CLI for 30nama.com — scrape direct download URLs")
  .version("0.1.0");

program
  .command("login")
  .description("Log in via a browser window (captures the token automatically)")
  .option("--token <token>", "skip the browser, save a usertoken you already have")
  .option("--email <email>", "useremail to record alongside a --token (optional)")
  .action(async (opts) => {
    if (opts.token) {
      await saveSession({
        usertoken: opts.token,
        useremail: opts.email,
        savedAt: new Date().toISOString(),
      });
      console.log(`Token saved to ${sessionPath()}.`);
      return;
    }

    const result = await interactiveLogin();
    await saveSession(sessionFromLogin(result));
    console.log(`Logged in as ${result.useremail} (${result.usertype}).`);
    console.log(`Session written to ${sessionPath()}.`);
  });

function sessionFromLogin(r: LoginResult): Session {
  return {
    usertoken: r.usertoken,
    userid: r.userid,
    useremail: r.useremail,
    username: r.username,
    usertype: r.usertype,
    savedAt: new Date().toISOString(),
  };
}

program
  .command("whoami")
  .description("Print stored session info")
  .action(async () => {
    const s = await loadSession();
    if (!s) {
      console.log("No session. Run `30nama login --token <token>`.");
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
  .action(async (urlOrId: string, opts) => {
    const session = await loadSession();
    if (!session) die("Not logged in. Run `30nama login --token <token>`.");

    const id = extractId(urlOrId);
    const result = await getDownloads(id, session.usertoken);

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const groups = filterGroups(result.download, opts);
    if (groups.length === 0) {
      console.log("No matching download groups.");
      return;
    }

    for (const g of groups) {
      printGroup(g);
    }
  });

function filterGroups(
  groups: DownloadGroup[],
  opts: { quality?: string; season?: string; episode?: string },
): DownloadGroup[] {
  const qNeedle = opts.quality?.toLowerCase();
  const seasonFilter = opts.season ? String(opts.season) : null;
  const episodeFilter = opts.episode ? String(opts.episode) : null;

  return groups
    .filter((g) => !qNeedle || g.quality.toLowerCase().includes(qNeedle))
    .filter((g) => !seasonFilter || g.season === seasonFilter)
    .map((g) => ({
      ...g,
      link: episodeFilter
        ? g.link.filter((l) => l.episode === episodeFilter)
        : g.link,
    }))
    .filter((g) => g.link.length > 0);
}

function printGroup(g: DownloadGroup): void {
  const tagBits = [g.encoder, g.size, g.tags].filter(Boolean).join(" · ");
  console.log(
    `\nS${g.season} — ${g.quality.trim()} (${tagBits}) — ${g.total_episode} ep`,
  );
  for (const l of g.link) {
    console.log(`  E${l.episode.padStart(2, "0")}  ${l.dl}`);
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
