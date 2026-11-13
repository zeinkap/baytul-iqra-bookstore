import { describe, it, expect } from 'vitest';
import { ART_CATEGORY, ART_LABEL_TITLE, isArtCategory, isArtPiece, categoryWrites, withoutArt, slugify, artSlugs } from '@/lib/artCollection';

/** Which catalog rows count as paintings from the Names of Allah x Scenes of Nature series (pure logic, no server or database). */
describe('Names of Allah x Scenes of Nature collection', () => {
  it('recognises the category regardless of case or extra spaces', () => {
    expect(isArtCategory(ART_CATEGORY)).toBe(true);
    expect(isArtCategory('names of allah x scenes of nature')).toBe(true);
    expect(isArtCategory('  Names of Allah  x Scenes of Nature ')).toBe(true);
    expect(isArtCategory('Seerah')).toBe(false);
    expect(isArtCategory('Names of Allah')).toBe(false);
  });

  it('prints a short title on the 2 x 2 inch stickers', () => {
    expect(ART_LABEL_TITLE).toBe('Names of Allah');
  });

  it('treats an item as art when any of its categories is the series', () => {
    expect(isArtPiece([ART_CATEGORY])).toBe(true);
    expect(isArtPiece(['Home decor', ART_CATEGORY])).toBe(true);
    expect(isArtPiece([{ name: ART_CATEGORY }])).toBe(true); // scan page loads categories as rows
    expect(isArtPiece(['Seerah', "Children's"])).toBe(false);
    expect(isArtPiece([])).toBe(false);
    expect(isArtPiece(null)).toBe(false);
  });

  it('keeps paintings out of the book catalog', () => {
    const rows = [
      { title: 'Book A', categories: ['Seerah'] },
      { title: 'Ar-Rahman', categories: [ART_CATEGORY] },
      { title: 'Book B', categories: [] },
    ];
    expect(withoutArt(rows).map((r) => r.title)).toEqual(['Book A', 'Book B']);
  });

  it('creates the art category on first use but only connects ordinary ones', () => {
    expect(categoryWrites(['Seerah', 'names of allah x scenes of nature'])).toEqual({
      connect: [{ name: 'Seerah' }],
      connectOrCreate: [{ where: { name: ART_CATEGORY }, create: { name: ART_CATEGORY } }],
    });
    expect(categoryWrites(['Seerah']).connectOrCreate).toEqual([]);
  });
});

describe('art page addresses', () => {
  it('slugifies titles', () => {
    expect(slugify('As-Salaam')).toBe('as-salaam');
    expect(slugify("Al-Rahman's Light!")).toBe('al-rahmans-light');
    expect(slugify('???')).toBe('painting');
  });

  it('keeps slugs unique, oldest title keeps the plain one', () => {
    const slugs = artSlugs([
      { id: 'b', title: 'As-Salaam', createdAt: '2026-02-01' },
      { id: 'a', title: 'as salaam', createdAt: '2026-01-01' },
      { id: 'c', title: 'Al-Noor', createdAt: '2026-03-01' },
    ]);
    expect(slugs.get('a')).toBe('as-salaam');
    expect(slugs.get('b')).toBe('as-salaam-2');
    expect(slugs.get('c')).toBe('al-noor');
  });
});

describe('Gallery listing', () => {
  it('TC-259: lists only paintings that have a photo', async () => {
    const { hasPhoto } = await import('@/lib/artCollection');
    expect(hasPhoto({ images: ['/book-images/as-salaam.webp'] })).toBe(true);
    expect(hasPhoto({ images: ['', '/book-images/as-salaam.webp'] })).toBe(true);
    expect(hasPhoto({ images: [] })).toBe(false);
    expect(hasPhoto({ images: ['  '] })).toBe(false);
    expect(hasPhoto({ images: null })).toBe(false);
    expect(hasPhoto({})).toBe(false);
  });
});
