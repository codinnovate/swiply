import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiException } from '../../common/errors/api.exception';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { Schedule, ScheduleDocument } from './schemas/schedule.schema';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(@InjectModel(Schedule.name) private readonly model: Model<ScheduleDocument>) {}
  create(workspaceId: string, dto: CreateScheduleDto) {
    if (dto.mode === 'fixed_days' && !dto.fixedDays) throw ApiException.unprocessable('SCHEDULE_CONFIGURATION_INVALID', 'fixedDays is required for fixed_days schedules');
    if (dto.mode === 'volume' && !dto.volume) throw ApiException.unprocessable('SCHEDULE_CONFIGURATION_INVALID', 'volume is required for volume schedules');
    return this.model.create({ ...dto, workspaceId: new Types.ObjectId(workspaceId), socialAccountIds: dto.socialAccountIds.map((id) => new Types.ObjectId(id)), endDate: dto.endDate ? new Date(dto.endDate) : null, autoGeneratePrompt: dto.autoGeneratePrompt ?? null, status: 'active' });
  }
  list(workspaceId: string) { return this.model.find({ workspaceId: new Types.ObjectId(workspaceId) }).sort({ createdAt: -1 }).exec(); }
  async update(workspaceId: string, id: string, dto: UpdateScheduleDto) { const schedule = await this.find(workspaceId, id); Object.assign(schedule, dto, dto.socialAccountIds ? { socialAccountIds: dto.socialAccountIds.map((value) => new Types.ObjectId(value)) } : {}, dto.endDate ? { endDate: new Date(dto.endDate) } : {}); return schedule.save(); }
  async pause(workspaceId: string, id: string) { const schedule = await this.find(workspaceId, id); schedule.status = 'paused'; return schedule.save(); }
  async resume(workspaceId: string, id: string) { const schedule = await this.find(workspaceId, id); schedule.status = 'active'; return schedule.save(); }
  async remove(workspaceId: string, id: string) { const schedule = await this.find(workspaceId, id); await schedule.deleteOne(); }
  private async find(workspaceId: string, id: string) { const schedule = await this.model.findOne({ _id: id, workspaceId: new Types.ObjectId(workspaceId) }).exec(); if (!schedule) throw ApiException.notFound('Schedule'); return schedule; }
}
