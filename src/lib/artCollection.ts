/**
 * "Allah's Names": a series of handmade acrylic paintings on wood, sold from the same catalog as the books.
 *
 * A painting is a normal Book row in this category (artist as `author`, "Acrylic on wood" as `format`,
 * stock 1 because each piece is one-of-a-kind). Everything else (Stripe checkout, QR scan page, in-person
 * price, receipts, stock, admin) works unchanged; this file only decides which rows count as art so the
 * pages can say "painting" instead of "book".
 */
export const ART_CATEGORY = "Allah's Names";
export const ART_PATH = '/allahs-names';

type CategoryLike = string | { name: string };

/** Case-insensitive, and tolerant of a typographic apostrophe typed in the admin (Allah’s Names). */
const normalize = (s: string) => s.replace(/[‘’]/g, "'").trim().toLowerCase();

export function isArtCategory(name: string): boolean {
  return normalize(name) === normalize(ART_CATEGORY);
}

/** True when any of the categories is the art collection. */
export function isArtPiece(categories: CategoryLike[] | null | undefined): boolean {
  return (categories ?? []).some((c) => isArtCategory(typeof c === 'string' ? c : c.name));
}

/** The books-only catalog (home page, hero, category menu): the art has its own page. */
export function withoutArt<T extends { categories: string[] }>(books: T[]): T[] {
  return books.filter((b) => !isArtPiece(b.categories));
}
