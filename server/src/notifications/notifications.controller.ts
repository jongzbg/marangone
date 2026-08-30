import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Request() req,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getNotifications(
      req.user.id,
      cursor,
      limit ? parseInt(limit) : 20,
    )
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    return this.notificationsService.getUnreadCount(req.user.id)
  }

  @Get('unread-message-count')
  async getUnreadMessageCount(@Request() req) {
    return this.notificationsService.getUnreadMessageCount(req.user.id)
  }

  @Post('read')
  async markAllAsRead(@Request() req) {
    return this.notificationsService.markAsRead(req.user.id)
  }

  @Post(':id/read')
  async markOneAsRead(@Param('id') id: string, @Request() req) {
    return this.notificationsService.markOneAsRead(id, req.user.id)
  }
}