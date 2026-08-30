import { Controller, Get, Patch, Post, Delete, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/users.dto';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('search')
  async searchUsers(@Query('q') query: string) {
    return this.usersService.searchUsers(query || '', 10);
  }

  @UseGuards(JwtAuthGuard)
  @Get('top/creators')
  async getTopCreators(@Request() req) {
    return this.usersService.getTopCreators(10, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('most-likes')
  async getMostLiked(@Request() req) {
    return this.usersService.getMostLiked(10, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':username')
  async getProfile(@Param('username') username: string, @Request() req) {
    return this.usersService.getProfile(username, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  async follow(@Param('id') id: string, @Request() req) {
    return this.usersService.follow(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/follow')
  async unfollow(@Param('id') id: string, @Request() req) {
    return this.usersService.unfollow(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':username/followers')
  async getFollowers(@Param('username') username: string, @Request() req) {
    return this.usersService.getFollowers(username, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':username/following')
  async getFollowing(@Param('username') username: string, @Request() req) {
    return this.usersService.getFollowing(username, req.user.id);
  }
}
