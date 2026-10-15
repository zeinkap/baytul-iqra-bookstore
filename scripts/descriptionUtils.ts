/** Descriptions are rendered with dangerouslySetInnerHTML, so only allow a tiny, attribute-free tag set. */
const ALLOWED_TAG = /^<\/?(p|ul|li|strong|em)>$|^<br\s*\/?>$/i;

export function validateDescriptionHtml(html: string): string | null {
  const text = html.trim();
  if (text.length < 40) return 'too short';
  if (text.length > 4000) return 'too long';
  const tags = text.match(/<[^>]*>?/g) ?? [];
  for (const tag of tags) {
    if (!ALLOWED_TAG.test(tag)) return `disallowed markup: ${tag.slice(0, 30)}`;
  }
  if (/<(?![/a-z])/i.test(text)) return 'stray "<" character';
  return null;
}

/** Plain-text view used for comparing/reading; mirrors what the chatbot sees. */
export function stripHtml(html: string): string {
  return html
    .replace(/<\/(p|li)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
