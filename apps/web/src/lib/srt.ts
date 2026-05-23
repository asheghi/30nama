/**
 * Convert an SRT subtitle file to WebVTT, so it can be loaded into a
 * `<track>` element via a Blob URL. The conversion is intentionally
 * minimal — just the things WebVTT requires that SRT doesn't have, plus
 * the timecode comma → period swap.
 */
export function srtToVtt(srt: string): string {
  const normalised = srt
    // strip BOM and CRLF
    .replace(/^﻿/, "")
    .replace(/\r+/g, "")
    // SRT timecodes use `,` for the millisecond separator; VTT uses `.`
    .replace(
      /(\d{2}:\d{2}:\d{2}),(\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}),(\d{3})/g,
      "$1.$2 --> $3.$4",
    );
  return `WEBVTT\n\n${normalised}`;
}

/**
 * Fetches an SRT URL, converts to VTT, returns a `blob:` URL suitable for
 * a `<track src=>`. The caller owns the URL and must `URL.revokeObjectURL`
 * it when done.
 *
 * Returns `null` if the fetch fails (CORS, 404, network) — callers should
 * gracefully fall back to no subtitle rather than crashing the player.
 */
export async function fetchSubtitleAsVttBlob(
  srtUrl: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const res = await fetch(srtUrl, { signal });
    if (!res.ok) return null;
    const text = await res.text();
    const vtt = srtToVtt(text);
    const blob = new Blob([vtt], { type: "text/vtt" });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/** Normalises the API's `link://` scheme to `https://`. */
export function normaliseSubtitleUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("link://")) return `https://${url.slice("link://".length)}`;
  return url;
}
