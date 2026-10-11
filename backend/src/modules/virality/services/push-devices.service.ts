import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import type { RegisterPushDeviceDto } from '../dto/virality.dto';
import { PushDevice } from '../schemas/push-device.schema';
import { ApnsService, type ApnsAlert, type ApnsResult } from './apns.service';

/** APNs tokens per install, and delivery to the install behind a duel side. */
@Injectable()
export class PushDevicesService {
  constructor(
    @InjectModel(PushDevice.name) private readonly devices: Model<PushDevice>,
    private readonly apns: ApnsService,
  ) {}

  async register(dto: RegisterPushDeviceDto): Promise<{ registered: true }> {
    // A token moves with a restored backup to a new install; the newest claim wins.
    await this.devices.deleteMany({ token: dto.token, installId: { $ne: dto.installId } });
    await this.devices.updateOne(
      { installId: dto.installId },
      { $set: { username: dto.username, token: dto.token, environment: dto.environment } },
      { upsert: true },
    );
    return { registered: true };
  }

  async unregister(installId: string): Promise<{ registered: false }> {
    await this.devices.deleteOne({ installId });
    return { registered: false };
  }

  /**
   * Pushes to the install, but only while it is still registered as `username`
   * — someone who switched accounts shouldn't hear about their old duels.
   */
  async notify(installId: string, username: string, alert: ApnsAlert): Promise<ApnsResult> {
    const device = await this.devices.findOne({ installId, username }).lean();
    if (!device) return 'skipped';
    const result = await this.apns.send(device, alert);
    if (result === 'unregistered') await this.devices.deleteOne({ _id: device._id });
    return result;
  }
}
