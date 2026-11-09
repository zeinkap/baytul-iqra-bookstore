/**
 * "Names of Allah x Scenes of Nature": a series of handmade acrylic paintings on wood, sold from the same catalog
 * as the books.
 *
 * A painting is a normal Book row in this category (artist as `author`, "Acrylic on wood" as `format`,
 * stock 1 because each piece is one-of-a-kind). Everything else (Stripe checkout, QR scan page, in-person
 * price, receipts, stock, admin) works unchanged; this file only decides which rows count as art so the
 * pages can say "painting" instead of "book".
 */
export const ART_CATEGORY = 'Names of Allah x Scenes of Nature';
/** Short label for the site menu; the full collection name is shown on the collection page. */
export const ART_NAV_LABEL = 'Art Canvases';
export const ART_PATH = '/names-of-allah';
/** Title printed on each painting's QR sticker (shorter than the collection title so it fits a 2 x 2 inch label). */
export const ART_LABEL_TITLE = 'Names of Allah';

/** Shown as the artist on paintings (the admin's painting form has no author field). Change here to rename. */
export const ART_ARTIST = 'Baytul Iqra';

type CategoryLike = string | { name: string };

/** Case-insensitive, and tolerant of extra spaces typed in the admin. */
const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

export function isArtCategory(name: string): boolean {
  return normalize(name) === normalize(ART_CATEGORY);
}

/** True when any of the categories is the art collection. */
export function isArtPiece(categories: CategoryLike[] | null | undefined): boolean {
  return (categories ?? []).some((c) => isArtCategory(typeof c === 'string' ? c : c.name));
}

/**
 * Prisma category writes for a book's category names. Ordinary categories must already exist (typos shouldn't
 * invent new ones), but the art category is created on first use so it can be picked in the admin straight away.
 */
export function categoryWrites(names: string[]) {
  const canonical = names.map((n) => (isArtCategory(n) ? ART_CATEGORY : n));
  return {
    connect: canonical.filter((n) => n !== ART_CATEGORY).map((name) => ({ name })),
    connectOrCreate: canonical.filter((n) => n === ART_CATEGORY).map((name) => ({ where: { name }, create: { name } })),
  };
}

/** The books-only catalog (home page, hero, category menu): the art has its own page. */
export function withoutArt<T extends { categories: string[] }>(books: T[]): T[] {
  return books.filter((b) => !isArtPiece(b.categories));
}
