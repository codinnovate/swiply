import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PlatformsModule } from '../../platforms/platforms.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { SocialAccount, SocialAccountSchema } from './schemas/social-account.schema';
import { SocialAccountsController } from './social-accounts.controller';
import { SocialAccountsService } from './social-accounts.service';

/**
 * WorkspacesModule is imported for WorkspaceGuard and for the WorkspaceMember
 * model, which the callback needs to re-prove membership without a bearer token.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: SocialAccount.name, schema: SocialAccountSchema }]),
    WorkspacesModule,
    PlatformsModule,
  ],
  controllers: [SocialAccountsController],
  providers: [SocialAccountsService],
  exports: [SocialAccountsService],
})
export class SocialAccountsModule {}
