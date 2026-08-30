import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/video' })
export class VideoNotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(VideoNotificationGateway.name);

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        this.logger.warn(`[handleConnection] No token — disconnecting ${client.id}`);
        client.disconnect();
        return;
      }
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub || payload.id;
      this.logger.log(`Client connected: ${client.data.userId} (${client.id})`);
    } catch (err) {
      this.logger.warn(`[handleConnection] JWT verify failed — disconnecting ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {}

  @SubscribeMessage('watch_video')
  handleWatchVideo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { videoId: string },
  ) {
    const room = `video:${data.videoId}`;
    // Only join once per client per room
    if (!client.rooms.has(room)) {
      client.join(room);
      this.logger.log(`Client ${client.data.userId} joined room ${room}`);
    }
  }

  @SubscribeMessage('leave_video')
  handleLeaveVideo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { videoId: string },
  ) {
    const room = `video:${data.videoId}`;
    client.leave(room);
  }

  emitVideoReady(
    videoId: string,
    payload: {
      status: 'ready' | 'failed';
      videoUrl?: string | null;
      thumbnailUrl?: string | null;
      resolutions?: string[];
      encodingProfile?: string;
      error?: string;
    },
  ) {
    this.server
      .to(`video:${videoId}`)
      .emit('VIDEO_READY', { videoId, ...payload });
    this.logger.log(
      `[VIDEO_READY] Emitted to video:${videoId} — status: ${payload.status}`,
    );
  }
}