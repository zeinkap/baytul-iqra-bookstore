/**
 * Normalizes an ISBN (strips hyphens/spaces, uppercases the X check digit).
 * Returns null if it isn't a valid ISBN-10 or ISBN-13 (checksum verified).
 */
export function normalizeIsbn(input: string): string | null {
  const isbn = input.replace(/[\s-]/g, '').toUpperCase();

  if (/^\d{13}$/.test(isbn)) {
    const sum = [...isbn].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
    return sum % 10 === 0 ? isbn : null;
  }

  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = [...isbn].reduce((acc, ch, i) => acc + (ch === 'X' ? 10 : Number(ch)) * (10 - i), 0);
    return sum % 11 === 0 ? isbn : null;
  }

  return null;
}
