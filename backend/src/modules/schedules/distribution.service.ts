import { Injectable } from '@nestjs/common';

export interface DistributionInput {
  postsPerMonth: number;
  start: Date;
  days: number;
  postingWindows: Array<{ startHour: number; endHour: number }>;
  minGapMinutes: number;
  jitterMinutes: number;
  random?: () => number;
}
export interface DistributedSlot { scheduledFor: Date; }

@Injectable()
export class DistributionService {
  distribute(input: DistributionInput): DistributedSlot[] {
    const random = input.random ?? Math.random;
    const slots: DistributedSlot[] = [];
    for (let day = 0; day < input.days && slots.length < input.postsPerMonth; day += 1) {
      const remaining = input.postsPerMonth - slots.length;
      const daysLeft = input.days - day;
      const target = Math.max(0, Math.round(remaining / daysLeft + (random() - 0.5) * 2));
      const count = Math.min(target, remaining);
      const window = input.postingWindows[day % input.postingWindows.length];
      for (let index = 0; index < count && slots.length < input.postsPerMonth; index += 1) {
        const baseMinutes = window.startHour * 60 + Math.floor(random() * Math.max(1, (window.endHour - window.startHour) * 60));
        const jitter = Math.round((random() * 2 - 1) * input.jitterMinutes);
        const minutes = baseMinutes + jitter + index * input.minGapMinutes;
        if (minutes >= window.startHour * 60 && minutes < window.endHour * 60) {
          const date = new Date(input.start.getTime() + day * 86_400_000);
          date.setUTCHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
          slots.push({ scheduledFor: date });
        }
      }
    }
    return slots;
  }
}
