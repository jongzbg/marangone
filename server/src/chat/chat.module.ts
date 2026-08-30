import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatCleanupService } from './chat-cleanup.service';
import { ChatCleanupTask } from './chat-cleanup.task';
import { AuthGuardModule } from '../auth/auth-guard.module';

@Module({
  imports: [
    ScheduleModule,
    AuthGuardModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, ChatCleanupService, ChatCleanupTask],
  exports: [ChatService, ChatCleanupService],
})
export class ChatModule {}
