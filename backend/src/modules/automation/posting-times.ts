const COUNTRY_TIMEZONES: Record<string, string> = {
  'United States': 'America/New_York',
  'United Kingdom': 'Europe/London',
  Canada: 'America/Toronto',
  Australia: 'Australia/Sydney',
  India: 'Asia/Kolkata',
  Germany: 'Europe/Berlin',
  France: 'Europe/Paris',
  Brazil: 'America/Sao_Paulo',
  Mexico: 'America/Mexico_City',
  Japan: 'Asia/Tokyo',
  'South Korea': 'Asia/Seoul',
  Indonesia: 'Asia/Jakarta',
  Philippines: 'Asia/Manila',
  Nigeria: 'Africa/Lagos',
  'South Africa': 'Africa/Johannesburg',
  'United Arab Emirates': 'Asia/Dubai',
  Spain: 'Europe/Madrid',
  Italy: 'Europe/Rome',
  Netherlands: 'Europe/Amsterdam',
  Ireland: 'Europe/Dublin',
};

/** Typical TikTok Photo Mode peaks, local wall-clock. */
export const TIKTOK_PEAK_WINDOWS = ['07:00', '12:15', '17:00', '19:00', '21:30', '08:45', '15:30'];

export const TARGET_COUNTRIES = Object.keys(COUNTRY_TIMEZONES);

export function timezoneForCountry(country?: string, fallback = 'UTC'): string {
  const name = country?.trim();
  if (!name) return fallback;
  if (COUNTRY_TIMEZONES[name]) return COUNTRY_TIMEZONES[name];
  const match = TARGET_COUNTRIES.find((item) => item.toLowerCase() === name.toLowerCase());
  return match ? COUNTRY_TIMEZONES[match] : fallback;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeHhmm(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function resizePostingTimes(times: string[], count: number): string[] {
  const size = Math.min(7, Math.max(1, count));
  const next = times.map((time) => normalizeHhmm(time)).filter((time): time is string => !!time);
  const unique = [...new Set(next)].slice(0, size);
  for (const peak of TIKTOK_PEAK_WINDOWS) {
    if (unique.length >= size) break;
    if (!unique.includes(peak)) unique.push(peak);
  }
  while (unique.length < size) {
    unique.push(`${String((9 + unique.length * 2) % 24).padStart(2, '0')}:00`);
  }
  return unique;
}
