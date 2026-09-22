import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlatformsModule } from '../../platforms/platforms.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { Content, ContentSchema } from '../content/schemas/content.schema';
import { SocialAccount, SocialAccountSchema } from '../social-accounts/schemas/social-account.schema';
import { Post, PostSchema } from './schemas/post.schema';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { SocialAccountsModule } from '../social-accounts/social-accounts.module';
import { MediaModule } from '../media/media.module';
import { PublishingProvidersModule } from '../publishing-providers/publishing-providers.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }, { name: Content.name, schema: ContentSchema }, { name: SocialAccount.name, schema: SocialAccountSchema }]), PlatformsModule, WorkspacesModule, SocialAccountsModule, PublishingProvidersModule, MediaModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
