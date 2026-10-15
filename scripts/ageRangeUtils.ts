import * as fs from 'fs';

/** Load .env when present (Node 20.12+); silently ignore if unavailable. */
export function loadEnv() {
  try {
    if (fs.existsSync('.env')) process.loadEnvFile('.env');
  } catch {
    /* env may already be set by the shell */
  }
}

/** Accepts "6-9", "10+", or "All ages" — the formats the chat assistant understands. */
export function isValidAgeRange(value: string): boolean {
  return /^(\d{1,2}\s*-\s*\d{1,2}|\d{1,2}\+|all ages)$/i.test(value.trim());
}

export function normalizeAgeRange(value: string): string {
  const v = value.trim();
  if (/^all ages$/i.test(v)) return 'All ages';
  return v.replace(/\s*-\s*/, '-');
}

export function csvEscape(value: string | null | undefined): string {
  const s = value ?? '';
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
