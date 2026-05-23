import type { ApiClient } from "../client.ts";

export interface DownloadLink {
  id: number;
  dl: string;
  episode: number;
  mediainfo: string;
  persian_subtitle?: string;
  source?: string;
}

export interface Download {
  id: number;
  season?: number;
  season_int?: number;
  season_name?: string;
  first_episode?: number;
  last_episode?: number;
  total_episode?: number;
  quality: string;
  size: string;
  resolution?: string;
  encoder?: string;
  version?: string;
  tags: string[];
  part?: string;
  note?: string;
  source?: string;
  dl?: string;
  persian_subtitle?: string;
  screenshot?: string;
  mediainfo?: string;
  link: DownloadLink[];
}

export interface DownloadGroups {
  seasons?: number[];
  total_seasons?: number;
  download: Record<string, Download[]> | Download[];
}

/**
 * Direct .mkv/.mp4 URLs for a single post. URLs in `dl` are one-shot and
 * signed with the requester's IP + an expiry; do not cache, do not share.
 */
export function getDownload(
  client: ApiClient,
  postId: number | string,
  freeDownload = false,
): Promise<DownloadGroups> {
  return client.call<DownloadGroups>("download", {
    post_id: postId,
    free_download: freeDownload,
  });
}
