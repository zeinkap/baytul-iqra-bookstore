import { describe, it, expect } from 'vitest';
import { ART_CATEGORY, isArtCategory, isArtPiece, withoutArt } from '@/lib/artCollection';

/** Which catalog rows count as paintings from the Allah's Names series (pure logic, no server or database). */
describe("Allah's Names collection", () => {
  it('recognises the category regardless of case or apostrophe style', () => {
    expect(isArtCategory(ART_CATEGORY)).toBe(true);
    expect(isArtCategory("allah's names")).toBe(true);
    expect(isArtCategory('Allah’s Names')).toBe(true); // curly apostrophe from a phone keyboard
    expect(isArtCategory(' Allah’s Names ')).toBe(true);
    expect(isArtCategory('Seerah')).toBe(false);
    expect(isArtCategory('Allahs Names')).toBe(false);
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
});
