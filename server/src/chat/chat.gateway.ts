import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/chat.dto';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private jwtService: JwtService,
    private chatService: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        client.emit('error', { message: 'No token provided' });
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token);
      // JWT uses { sub: userId }, but our generateToken uses 'sub' claim
      client.data.userId = payload.sub || payload.id;
      client.data.username = payload.username || payload.name;
    } catch {
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {}

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    try {
      await this.chatService.getConversation(data.conversationId, userId);
      const room = `conversation:${data.conversationId}`;
      client.join(room);
      client.emit('joined', { conversationId: data.conversationId });
    } catch {
      client.emit('error', { message: 'Not authorized for this conversation' });
    }
  }

  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const room = `conversation:${data.conversationId}`;
    client.leave(room);
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      content?: string;
      mediaUrl?: string;
      clientId?: string;
    },
  ) {
    const userId = client.data.userId;
    console.log(`[ChatGateway] send_message from userId=${userId}, conversationId=${data.conversationId}, clientId=${data.clientId}`);
    console.log(`[ChatGateway] client.data=`, JSON.stringify(client.data));
    if (!userId) {
      console.log(`[ChatGateway] ERROR: no userId on client`);
      client.emit('message_error', { conversationId: data.conversationId, clientId: data.clientId, error: 'Not authenticated' });
      return;
    }

    const dto: SendMessageDto = {
      content: data.content,
      mediaUrl: data.mediaUrl,
      clientId: data.clientId,
    };

    try {
      const message = await this.chatService.sendMessage(
        data.conversationId,
        userId,
        dto,
      );
      console.log(`[ChatGateway] message saved:`, JSON.stringify(message).slice(0, 200));
      const room = `conversation:${data.conversationId}`;
      this.server.to(room).emit('new_message', { message });
    } catch (e: any) {
      console.log(`[ChatGateway] ERROR saving message:`, e.message);
      client.emit('message_error', {
        conversationId: data.conversationId,
        clientId: data.clientId,
        error: e.message || 'Failed to send message',
      });
    }
  }

  @SubscribeMessage('typing_start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const room = `conversation:${data.conversationId}`;
    client.to(room).emit('user_typing', {
      conversationId: data.conversationId,
      userId: client.data.userId,
      username: client.data.username,
    });
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const room = `conversation:${data.conversationId}`;
    client.to(room).emit('user_stopped_typing', {
      conversationId: data.conversationId,
      userId: client.data.userId,
    });
  }
}
