import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { Post, PostSchema } from '../posts/schemas/post.schema';
import {
  SocialAccount,
  SocialAccountSchema,
} from '../social-accounts/schemas/social-account.schema';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { PublishingProviderGateway } from './publishing-provider.gateway';
import { PublishingProviderReconciliationService } from './publishing-provider-reconciliation.service';
import { PublishingProvidersController } from './publishing-providers.controller';
import { PublishingProvidersService } from './publishing-providers.service';
import {
  PublishingProviderConnection,
  PublishingProviderConnectionSchema,
} from './schemas/publishing-provider-connection.schema';

@Module({
  imports: [
    CryptoModule,
    WorkspacesModule,
    MongooseModule.forFeature([
      { name: PublishingProviderConnection.name, schema: PublishingProviderConnectionSchema },
      { name: SocialAccount.name, schema: SocialAccountSchema },
      { name: Post.name, schema: PostSchema },
    ]),
  ],
  controllers: [PublishingProvidersController],
  providers: [
    PublishingProvidersService,
    PublishingProviderGateway,
    PublishingProviderReconciliationService,
  ],
  exports: [PublishingProvidersService],
})
export class PublishingProvidersModule {}
