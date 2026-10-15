/** Same rule the books API uses for image sources: a site path or an http(s) URL. */
export function isValidImageSrc(src: string): boolean {
  return src.length > 0 && (src.startsWith('/') || /^https?:\/\/\S+$/.test(src));
}

/**
 * Pulls the image URLs to add out of one CSV row. Reads every `add_image*` column
 * (add_image_1, add_image_2, ...), and also splits any cell on `|` or newlines so several URLs
 * can be pasted into one cell. Drops blanks, repeats, and anything already on the book.
 */
export function collectNewImages(
  row: Record<string, string | undefined>,
  existing: string[]
): { toAdd: string[]; invalid: string[] } {
  const seen = new Set(existing);
  const toAdd: string[] = [];
  const invalid: string[] = [];

  for (const [column, value] of Object.entries(row)) {
    if (!/^add_image/i.test(column) || !value) continue;
    for (const part of value.split(/[|\n\r]+/)) {
      const url = part.trim();
      if (!url) continue;
      if (!isValidImageSrc(url)) {
        invalid.push(url);
      } else if (!seen.has(url)) {
        seen.add(url);
        toAdd.push(url);
      }
    }
  }
  return { toAdd, invalid };
}
