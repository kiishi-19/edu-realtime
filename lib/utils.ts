import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Normalize a date string coming from the database to always be
 * interpreted as UTC, regardless of whether it was stored by
 * SQLite's datetime('now') (e.g. "2026-04-09 21:59:00", no timezone)
 * or JavaScript's Date.toISOString() (e.g. "2026-04-09T17:08:00.000Z").
 */
function toUTC(dateStr: string): Date {
  // Already has a timezone marker — parse as-is
  if (dateStr.endsWith('Z') || dateStr.includes('+')) {
    return new Date(dateStr);
  }
  // SQLite bare format: "YYYY-MM-DD HH:MM:SS" — treat as UTC
  return new Date(dateStr.replace(' ', 'T') + 'Z');
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
    timeZoneName: 'short',
  }).format(toUTC(dateStr));
}

export function formatDuration(startStr: string, endStr?: string | null): string {
  const start = toUTC(startStr).getTime();
  const end = endStr ? toUTC(endStr).getTime() : Date.now();
  const diff = Math.floor((end - start) / 1000);

  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'text-green-600 bg-green-50 border-green-200';
    case 'scheduled': return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'ended': return 'text-gray-500 bg-gray-50 border-gray-200';
    default: return 'text-gray-500 bg-gray-50 border-gray-200';
  }
}
