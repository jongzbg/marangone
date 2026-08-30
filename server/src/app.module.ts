import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { HashtagsModule } from './hashtags/hashtags.module';
import { UploadModule } from './upload/upload.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { VideoModule } from './video/video.module';
import { MaintenanceModule } from './maintenance/maintenance.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
    AuthModule,
    UsersModule,
    PostsModule,
    HashtagsModule,
    UploadModule,
    VideoModule,
    ChatModule,
    NotificationsModule,
    MaintenanceModule,
  ],
})
export class AppModule {}
