import type { ApiClient } from "../client.ts";

/**
 * One quality option for an HLS stream. `auto` / `6ch` / `2ch` carry the
 * actual playlist URLs for the original / 5.1 surround / stereo audio
 * variants. Not every quality has every channel — empty strings mean "not
 * available".
 */
export interface StreamSource {
  /** Display label: "خودکار" (auto) | "1080p" | "720p" | "480p" | "360p" | "240p". */
  label: string;
  /** Default audio variant URL (`.m3u8`). */
  auto: string;
  /** 5.1 surround variant URL (`.m3u8`). May be empty if not available. */
  "6ch": string;
  /** Stereo variant URL (`.m3u8`). May be empty if not available. */
  "2ch": string;
}

export interface StreamEpisodeData {
  /** `fid` — used in observer pings and baked into the stream URLs. */
  id: string;
  season: string;
  /** Display number. */
  number: string;
  /** Zero-padded episode number; may be `"17,18"` for combined episodes. */
  episode: string;
  /** Persian title. */
  title: string;
}

export interface StreamEpisodeFile {
  /** Master HLS playlist (adaptive auto). */
  url: string;
  /** Same URL, possibly IP-pinned variant. */
  ip: string;
  source: StreamSource[];
}

export interface StreamSubtitle {
  /** `link://subtitle.30nama.com/...` — replace `link://` with `https://`. */
  fa: string;
  /** `link://subtitle.30nama.com/...` — replace `link://` with `https://`. */
  en: string;
}

export interface StreamOptions {
  /** `HH:MM:SS`. */
  intro_start: string;
  /** `HH:MM:SS`. */
  intro_end: string;
  previously_start: string | null;
  previously_end: string | null;
  /** `HH:MM:SS` — episode end / credits start. */
  end: string;
  /** Per-episode hash sent to the observer endpoint. */
  key: string;
}

export interface StreamEpisode {
  data: StreamEpisodeData;
  file: StreamEpisodeFile;
  subtitle: StreamSubtitle;
  options: StreamOptions;
}

export interface StreamWatched {
  season: string;
  episode: string;
  title: string;
  number: string;
  id: number;
  /** Resume seconds as a string. */
  time: string;
  /** 0–100. */
  progress: number;
}

export interface StreamImagePoster {
  big: string;
  big_webp: string;
  large: string;
  large_webp: string;
  medium: string;
  medium_webp: string;
  small: string;
  small_webp: string;
}

export interface StreamImage {
  cover: string;
  cover_webp: string;
  poster: StreamImagePoster;
}

export interface StreamResult {
  data: { post_id: number; title: string };
  /** Season number (string key) → episodes. Movies typically return one key with one entry. */
  list: Record<string, StreamEpisode[]>;
  watched: StreamWatched;
  image: StreamImage;
  /** Ad server URL — ignored. */
  vast2: string;
}

// The raw shape hana-api returns for `action/stream`. It's a flat array of
// episodes (`hls[]`) with season/episode info per entry — the public
// `StreamResult` shape above is the season-grouped view the player code
// expects, and `adaptStream` below maps between them.
interface RawStreamM3u8 {
  default: string;
  "6ch": string;
  "2ch": string;
  label: string;
}

interface RawStreamHls {
  info: {
    file_id: number;
    season?: number;
    episode?: string;
    episode_number?: number;
    episode_name?: string;
  };
  file: {
    m3u8: RawStreamM3u8[];
    subtitle?: { en?: string; fa?: string };
  };
  options: {
    intro_start?: string;
    intro_end?: string;
    previously_start?: string;
    previously_end?: string;
    end?: string;
    token: string;
  };
}

interface RawStreamData {
  info: { post_id: number; title: { english: string; local?: string } };
  image: { cover?: { webp: string; jpg: string } };
  continue_watching?: {
    post_id: number;
    file_id: number;
    time: number;
    display_time: string;
    progress: number;
  };
  vast2: string;
  hls: RawStreamHls[];
}

function adaptStream(raw: RawStreamData): StreamResult {
  const list: Record<string, StreamEpisode[]> = {};
  for (const h of raw.hls ?? []) {
    const season = String(h.info.season ?? 1);
    const episode: StreamEpisode = {
      data: {
        id: String(h.info.file_id),
        season,
        number: String(h.info.episode_number ?? h.info.episode ?? ""),
        episode: String(h.info.episode ?? h.info.episode_number ?? ""),
        title: h.info.episode_name ?? "",
      },
      file: {
        url: h.file.m3u8?.[0]?.default ?? "",
        ip: h.file.m3u8?.[0]?.default ?? "",
        source: (h.file.m3u8 ?? []).map((m) => ({
          label: m.label,
          auto: m.default,
          "6ch": m["6ch"],
          "2ch": m["2ch"],
        })),
      },
      subtitle: {
        fa: h.file.subtitle?.fa ?? "",
        en: h.file.subtitle?.en ?? "",
      },
      options: {
        intro_start: h.options.intro_start ?? "",
        intro_end: h.options.intro_end ?? "",
        previously_start: h.options.previously_start ?? null,
        previously_end: h.options.previously_end ?? null,
        end: h.options.end ?? "",
        key: h.options.token,
      },
    };
    (list[season] ??= []).push(episode);
  }

  // `continue_watching` is post-level — to fill the season/episode/title
  // fields the player expects on `watched`, look up the matching hls entry.
  let watched: StreamWatched = {
    season: "",
    episode: "",
    title: "",
    number: "",
    id: 0,
    time: "0",
    progress: 0,
  };
  if (raw.continue_watching) {
    const cw = raw.continue_watching;
    const match = raw.hls?.find((h) => h.info.file_id === cw.file_id);
    watched = {
      season: String(match?.info.season ?? ""),
      episode: String(match?.info.episode ?? ""),
      number: String(match?.info.episode_number ?? ""),
      title: match?.info.episode_name ?? "",
      id: cw.file_id,
      time: String(cw.time),
      progress: cw.progress,
    };
  }

  const coverWebp = raw.image.cover?.webp ?? "";
  const coverJpg = raw.image.cover?.jpg ?? "";

  return {
    data: { post_id: raw.info.post_id, title: raw.info.title.english },
    list,
    watched,
    image: {
      cover: coverJpg,
      cover_webp: coverWebp,
      // Hana-api doesn't return poster variants on the stream payload;
      // the title/single response already carries posters, so the player
      // never needs them. Leave the slots empty rather than fabricating.
      poster: {
        big: "",
        big_webp: "",
        large: "",
        large_webp: "",
        medium: "",
        medium_webp: "",
        small: "",
        small_webp: "",
      },
    },
    vast2: raw.vast2,
  };
}

/**
 * Fetch the HLS stream metadata for a title. Returns season/episode tree,
 * per-episode quality + audio sources, subtitles, intro/end markers, and
 * the user's resume position.
 *
 * URLs in `file.url` / `file.source[*]` are IP-signed and short-TTL. Never
 * cache them — request fresh on every play session.
 *
 * The action is `stream` with `post_id` in the body (matching the official
 * 30nama-sdk). Hana-api returns a flat `hls[]` array; we group it by
 * season here so the rest of the app can stay shaped like the old
 * interface.30nama.com payload.
 */
export async function getStream(
  client: ApiClient,
  postId: number | string,
  freeStream = false,
): Promise<StreamResult> {
  const raw = await client.call<RawStreamData>("stream", {
    post_id: postId,
    free_stream: freeStream,
  });
  return adaptStream(raw);
}
