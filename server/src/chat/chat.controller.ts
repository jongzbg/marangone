import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateConversationDto, SendMessageDto, MessageQueryDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  async getConversations(@Request() req) {
    return this.chatService.getUserConversations(req.user.id);
  }

  @Post()
  async createConversation(@Request() req, @Body() dto: CreateConversationDto) {
    console.log('[Chat] req.user:', req.user);
    console.log('[Chat] dto.otherUserId:', dto.otherUserId);
    if (!dto.otherUserId) {
      throw new ForbiddenException('otherUserId is required');
    }
    if (dto.otherUserId === req.user.id) {
      throw new ForbiddenException('Cannot create conversation with yourself');
    }
    return this.chatService.getOrCreate1to1(req.user.id, dto.otherUserId);
  }

  @Get(':id')
  async getConversation(@Param('id') id: string, @Request() req) {
    return this.chatService.getConversation(id, req.user.id);
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id') id: string,
    @Request() req,
    @Query() query: MessageQueryDto,
  ) {
    return this.chatService.getMessages(id, req.user.id, query.cursor, query.limit);
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(id, req.user.id, dto);
  }

  @Post(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req) {
    return this.chatService.markAsRead(id, req.user.id);
  }

  @Get(':id/unread-count')
  async getUnreadCount(@Param('id') id: string, @Request() req) {
    return this.chatService.getUnreadCount(id, req.user.id);
  }
}
