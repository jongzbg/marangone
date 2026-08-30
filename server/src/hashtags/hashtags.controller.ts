import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { HashtagsService } from './hashtags.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('hashtags')
export class HashtagsController {
  constructor(private hashtagsService: HashtagsService) {}

  @Get('trending')
  async getTrendingHashtags() {
    return this.hashtagsService.getTrendingHashtags();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':tag/posts')
  async getHashtagPosts(
    @Param('tag') tag: string,
    @Query('type') type: 'popular' | 'latest' | 'following' = 'latest',
    @Request() req: any,
  ) {
    return this.hashtagsService.getPostsByHashtag(tag, type, req.user.id);
  }
}