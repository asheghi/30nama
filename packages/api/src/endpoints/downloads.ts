import type { ApiClient } from "../client.ts";

export interface DownloadLink {
  id: string;
  dl: string;
  ipdl: string;
  episode: string;
  mediainfo: string;
  persian_subtitle: string | null;
  source: string;
}

export interface DownloadGroup {
  id: string;
  season: string;
  season_int: number;
  season_name: string | null;
  first_episode: string;
  last_episode: string;
  total_episode: number;
  quality: string;
  size: string;
  encoder: string;
  note: string | null;
  persian_subtitle: boolean;
  x265: boolean;
  "10bit": boolean;
  tags: string;
  link: DownloadLink[];
}

export interface DownloadsResult {
  seasons: number;
  download: DownloadGroup[];
  is_series: boolean;
}

export function getDownloads(
  client: ApiClient,
  id: string | number,
  freeDownload = false,
): Promise<DownloadsResult> {
  return client.post<DownloadsResult>(`/action/download/id/${id}`, {
    formBody: { freeDownload },
  });
}

const ID_RE = /\/(?:movie|series|anime)\/(\d+)\b/;

export function extractId(input: string): string {
  if (/^\d+$/.test(input)) return input;
  const m = input.match(ID_RE);
  if (m) return m[1];
  throw new Error(
    `Could not extract a numeric id from "${input}". Pass a 30nama.com URL or a bare id.`,
  );
}
