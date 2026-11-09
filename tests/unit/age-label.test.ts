import { describe, expect, it } from 'vitest';
import { ageLabel } from '@/lib/ageLabel';

describe('Age label', () => {
  it('writes numeric ranges as "Ages ..."', () => {
    expect(ageLabel('4-7')).toBe('Ages 4-7');
    expect(ageLabel('16+')).toBe('Ages 16+');
    expect(ageLabel(' 6-9 ')).toBe('Ages 6-9');
  });

  it('keeps wording like "All ages" as it is', () => {
    expect(ageLabel('All ages')).toBe('All ages');
  });

  it('is null when there is no age range', () => {
    expect(ageLabel(null)).toBeNull();
    expect(ageLabel(undefined)).toBeNull();
    expect(ageLabel('  ')).toBeNull();
  });
});
