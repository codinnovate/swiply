const WEEKDAY_PATTERNS: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function buildPostingSlots(input: {
  cadence: 'daily' | 'weekly';
  timesOfDay: string[];
  postsPerPeriod: number;
  timeZone: string;
  from?: Date;
}): Date[] {
  const from = input.from ?? new Date();
  const times = input.timesOfDay.length ? input.timesOfDay : ['09:00'];
  const count = Math.min(7, Math.max(1, input.postsPerPeriod));
  const slots: Date[] = [];

  if (input.cadence === 'daily') {
    for (let day = 0; day < 7; day += 1) {
      for (let index = 0; index < count; index += 1) {
        const candidate = zonedWallTime(addUtcDays(from, day), times[index % times.length], input.timeZone);
        slots.push(candidate.getTime() > from.getTime() + 60_000 ? candidate : addUtcDays(candidate, 7));
      }
    }
  } else {
    const weekdays = WEEKDAY_PATTERNS[count] ?? WEEKDAY_PATTERNS[3];
    for (let week = 0; week < 2; week += 1) {
      weekdays.forEach((weekday, index) => {
        const candidate = nextWeekdayWallTime(from, weekday, week, times[index % times.length], input.timeZone);
        if (candidate.getTime() > from.getTime() + 60_000) slots.push(candidate);
      });
    }
  }

  return [...new Map(slots.map((slot) => [slot.toISOString(), slot])).values()].sort(
    (left, right) => left.getTime() - right.getTime(),
  );
}

export function zonedWallTime(day: Date, hhmm: string, timeZone: string): Date {
  const [hour, minute] = parseTime(hhmm);
  const wall = wallClock(day.getTime(), timeZone);
  let utc = Date.UTC(wall.year, wall.month - 1, wall.day, hour, minute);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const shown = wallClock(utc, timeZone);
    const delta =
      Date.UTC(wall.year, wall.month - 1, wall.day, hour, minute) -
      Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute);
    utc += delta;
    if (delta === 0) break;
  }
  return new Date(utc);
}

function nextWeekdayWallTime(
  from: Date,
  weekday: number,
  weekOffset: number,
  hhmm: string,
  timeZone: string,
) {
  const wall = wallClock(from.getTime(), timeZone);
  const current = new Date(Date.UTC(wall.year, wall.month - 1, wall.day));
  const shift = (weekday - current.getUTCDay() + 7) % 7;
  const target = addUtcDays(current, shift + weekOffset * 7);
  const slotted = zonedWallTime(target, hhmm, timeZone);
  if (weekOffset === 0 && slotted.getTime() <= from.getTime() + 60_000) {
    return zonedWallTime(addUtcDays(target, 7), hhmm, timeZone);
  }
  return slotted;
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

function parseTime(hhmm: string) {
  const [hour, minute] = hhmm.split(':').map(Number);
  return [Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0] as const;
}

function wallClock(utc: number, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utc));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    return {
      year: value('year'),
      month: value('month'),
      day: value('day'),
      hour: value('hour'),
      minute: value('minute'),
    };
  } catch {
    const date = new Date(utc);
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
    };
  }
}
