import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { WorkspaceGuard } from '../../common/guards/workspace.guard';
import { UsersModule } from '../users/users.module';
import {
  WorkspaceMember,
  WorkspaceMemberSchema,
} from './schemas/workspace-member.schema';
import { Workspace, WorkspaceSchema } from './schemas/workspace.schema';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

/**
 * Exports WorkspaceGuard (and the WorkspaceMember model it depends on) so any
 * feature module can `@UseGuards(WorkspaceGuard)` just by importing this module.
 */
@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: WorkspaceMember.name, schema: WorkspaceMemberSchema },
    ]),
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceGuard],
  exports: [WorkspacesService, WorkspaceGuard, MongooseModule],
})
export class WorkspacesModule {}
