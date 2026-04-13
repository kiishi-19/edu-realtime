import { describe, it, expect } from 'vitest';
import {
  generateJoinCode,
  formatDate,
  formatDuration,
  getInitials,
  getStatusColor,
  cn,
} from '@/lib/utils';

describe('generateJoinCode', () => {
  it('returns a 6-character string', () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(6);
  });

  it('uses only allowed characters (no 0, O, I, 1)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateJoinCode();
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateJoinCode()));
    // With 32^6 = 1,073,741,824 possibilities, 100 codes should all be unique
    expect(codes.size).toBe(100);
  });
});

describe('formatDate', () => {
  it('returns — for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('formats a valid ISO date string', () => {
    const result = formatDate('2024-01-15T10:30:00.000Z');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });
});

describe('formatDuration', () => {
  it('shows minutes for short durations', () => {
    const start = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatDuration(start)).toBe('5m');
  });

  it('shows hours and minutes for long durations', () => {
    const start = new Date(Date.now() - 90 * 60 * 1000).toISOString();
    expect(formatDuration(start)).toBe('1h 30m');
  });

  it('uses end date when provided', () => {
    const start = '2024-01-01T10:00:00.000Z';
    const end = '2024-01-01T11:30:00.000Z';
    expect(formatDuration(start, end)).toBe('1h 30m');
  });
});

describe('getInitials', () => {
  it('returns two uppercase letters for a full name', () => {
    expect(getInitials('Jane Smith')).toBe('JS');
  });

  it('works with a single name (returns first letter only)', () => {
    expect(getInitials('Alice')).toBe('A');
  });

  it('truncates to 2 characters max', () => {
    expect(getInitials('John Michael Doe')).toBe('JM');
  });
});

describe('getStatusColor', () => {
  it('returns green classes for active', () => {
    expect(getStatusColor('active')).toContain('green');
  });

  it('returns blue classes for scheduled', () => {
    expect(getStatusColor('scheduled')).toContain('blue');
  });

  it('returns gray classes for ended', () => {
    expect(getStatusColor('ended')).toContain('gray');
  });

  it('returns gray for unknown status', () => {
    expect(getStatusColor('unknown')).toContain('gray');
  });
});

describe('cn (class merging)', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('deduplicates tailwind conflicts', () => {
    // tailwind-merge should prefer the last conflicting class
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });
});
