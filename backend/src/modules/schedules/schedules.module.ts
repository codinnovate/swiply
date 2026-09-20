import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { Schedule, ScheduleSchema } from './schemas/schedule.schema';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { DistributionService } from './distribution.service';
@Module({ imports: [MongooseModule.forFeature([{ name: Schedule.name, schema: ScheduleSchema }]), WorkspacesModule], controllers: [SchedulesController], providers: [SchedulesService, DistributionService], exports: [SchedulesService, DistributionService] })
export class SchedulesModule {}
