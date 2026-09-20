import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentWorkspace, RequireRoles } from '../../common/decorators/workspace.decorator';
import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { SchedulesService } from './schedules.service';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
@ApiTags('schedules') @ApiBearerAuth() @UseGuards(WorkspaceGuard) @Controller('schedules')
export class SchedulesController {
  constructor(private readonly service: SchedulesService) {}
  @Get() async list(@CurrentWorkspace('workspaceId') id: string) { return { data: await this.service.list(id) }; }
  @Post() @RequireRoles('editor') async create(@CurrentWorkspace('workspaceId') id: string, @Body() dto: CreateScheduleDto) { return { data: await this.service.create(id, dto) }; }
  @Patch(':id') @RequireRoles('editor') async update(@CurrentWorkspace('workspaceId') id: string, @Param('id') scheduleId: string, @Body() dto: UpdateScheduleDto) { return { data: await this.service.update(id, scheduleId, dto) }; }
  @Patch(':id/pause') @RequireRoles('editor') async pause(@CurrentWorkspace('workspaceId') id: string, @Param('id') scheduleId: string) { return { data: await this.service.pause(id, scheduleId) }; }
  @Patch(':id/resume') @RequireRoles('editor') async resume(@CurrentWorkspace('workspaceId') id: string, @Param('id') scheduleId: string) { return { data: await this.service.resume(id, scheduleId) }; }
  @Delete(':id') @RequireRoles('editor') async remove(@CurrentWorkspace('workspaceId') id: string, @Param('id') scheduleId: string) { await this.service.remove(id, scheduleId); }
}
