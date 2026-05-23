/**
 * Pulls a numeric post id out of a 30nama url or a bare id string. Accepts:
 *   - "12345"
 *   - "https://30nama.com/post/MOVIE-12345/..."
 *   - "https://30nama.com/single/12345/..."
 *   - any string containing a slash-bounded numeric segment
 */
export function extractId(input: string): string {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  // Look for the last numeric segment between slashes or after a "-"
  const match =
    trimmed.match(/[\/-](\d{2,})(?=[\/?#]|$)/) ??
    trimmed.match(/(\d{2,})/);
  if (!match) {
    throw new Error(`Could not extract a numeric id from "${input}"`);
  }
  return match[1];
}
