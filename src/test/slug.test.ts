import { expect, it } from 'vitest';
import { slugify } from '@/lib/slug';

it('does not leave a trailing hyphen when a public URL is truncated', () => {
  expect(slugify('a'.repeat(59) + ' b')).toBe('a'.repeat(59));
});
