import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: any, user: TUser, info: any): TUser {
    if (err || !user) {
      console.error('[JwtAuthGuard] Auth failed:', err?.message || info?.message || 'No user');
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
