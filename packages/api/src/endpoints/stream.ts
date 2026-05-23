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

/**
 * Fetch the HLS stream metadata for a title. Returns season/episode tree,
 * per-episode quality + audio sources, subtitles, intro/end markers, and
 * the user's resume position.
 *
 * URLs in `file.url` / `file.source[*]` are IP-signed and short-TTL. Never
 * cache them — request fresh on every play session.
 */
export function getStream(
  client: ApiClient,
  postId: number | string,
): Promise<StreamResult> {
  return client.call<StreamResult>(`stream/id/${postId}`, {});
}
