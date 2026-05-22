import { apiPost } from "./client.ts";

export interface LoginResult {
  usertoken: string;
  userid: number;
  allowed_to_download: boolean;
  allowed_to_stream: boolean;
  usertype: string;
  expire: string;
  useremail: string;
  username: string;
  gavatar: string;
  avatar: string;
}

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

export function login(
  email: string,
  password: string,
  recaptchaResponse: string,
): Promise<LoginResult> {
  return apiPost<LoginResult>("/action/loginV2", {
    body: {
      userlogin: email,
      userpassword: password,
      "g-recaptcha-response": recaptchaResponse,
    },
  });
}

export function getDownloads(
  id: string | number,
  token: string,
  freeDownload = false,
): Promise<DownloadsResult> {
  return apiPost<DownloadsResult>(`/action/download/id/${id}`, {
    token,
    body: { freeDownload },
  });
}

const ID_RE = /\/(?:movie|series)\/(\d+)\b/;

export function extractId(input: string): string {
  if (/^\d+$/.test(input)) return input;
  const m = input.match(ID_RE);
  if (m) return m[1];
  throw new Error(
    `Could not extract a numeric id from "${input}". Pass a 30nama.com URL or a bare id.`,
  );
}
