import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { DEFAULT_XP_CONFIG, XP_SIGNALS, type XpConfig } from '../domain/xp';
import type { XpConfigDto } from '../dto/virality.dto';
import { XpSettings } from '../schemas/xp-settings.schema';

const SETTINGS_KEY = 'default';
/** How long a read config is reused before checking for an edit. */
const CACHE_TTL_MS = 60_000;

@Injectable()
export class XpConfigService {
  private cached: { config: XpConfig; at: number } | null = null;

  constructor(@InjectModel(XpSettings.name) private readonly settings: Model<XpSettings>) {}

  async get(): Promise<XpConfig> {
    if (this.cached && Date.now() - this.cached.at < CACHE_TTL_MS) return this.cached.config;
    const stored = await this.settings.findOne({ key: SETTINGS_KEY }).lean();
    const config = this.merge(stored);
    this.cached = { config, at: Date.now() };
    return config;
  }

  async update(dto: XpConfigDto): Promise<XpConfig> {
    const weights = Object.entries(dto.weights ?? {}).filter(
      ([signal, value]) => XP_SIGNALS.includes(signal as never) && value !== undefined,
    );
    const stored = await this.settings
      .findOneAndUpdate(
        { key: SETTINGS_KEY },
        {
          $set: {
            ...Object.fromEntries(weights.map(([signal, value]) => [`weights.${signal}`, value])),
            ...(dto.levelBaseXp !== undefined ? { levelBaseXp: dto.levelBaseXp } : {}),
            ...(dto.replierDecayWindowDays !== undefined
              ? { replierDecayWindowDays: dto.replierDecayWindowDays }
              : {}),
            ...(dto.duplicateWindowDays !== undefined
              ? { duplicateWindowDays: dto.duplicateWindowDays }
              : {}),
          },
          $inc: { version: 1 },
          $setOnInsert: { key: SETTINGS_KEY },
        },
        { upsert: true, new: true, setDefaultsOnInsert: false },
      )
      .lean();
    const config = this.merge(stored);
    this.cached = { config, at: Date.now() };
    return config;
  }

  private merge(stored: Partial<XpSettings> | null): XpConfig {
    if (!stored) return DEFAULT_XP_CONFIG;
    return {
      version: stored.version ?? DEFAULT_XP_CONFIG.version,
      weights: { ...DEFAULT_XP_CONFIG.weights, ...stored.weights },
      levelBaseXp: stored.levelBaseXp ?? DEFAULT_XP_CONFIG.levelBaseXp,
      replierDecayWindowDays:
        stored.replierDecayWindowDays ?? DEFAULT_XP_CONFIG.replierDecayWindowDays,
      duplicateWindowDays: stored.duplicateWindowDays ?? DEFAULT_XP_CONFIG.duplicateWindowDays,
    };
  }
}
