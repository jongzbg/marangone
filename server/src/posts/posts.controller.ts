import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePostDto } from './dto/posts.dto';

@Controller('posts')
export class PostsController {
  constructor(private postsService: PostsService) {}

  // ── Authenticated Feed ──────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('feed')
  async getFeed(@Request() req, @Query('cursor') cursor?: string) {
    return this.postsService.getFeed(req.user.id, cursor);
  }

  // ── Authenticated Following Feed ───────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('following-feed')
  async getFollowingFeed(@Request() req, @Query('cursor') cursor?: string) {
    return this.postsService.getFollowingFeed(req.user.id, cursor);
  }

  // ── Authenticated User Posts (with viewer likes check) ─────────────
  // ⚠️ Must be BEFORE :id route — route order matters in NestJS!
  @UseGuards(JwtAuthGuard)
  @Get('user/:username')
  async getUserPosts(@Param('username') username: string, @Request() req, @Query('cursor') cursor?: string) {
    return this.postsService.getUserPosts(username, req.user.id, cursor);
  }

  // ── Authenticated Create / Delete ──────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post()
  async createPost(@Request() req, @Body() dto: CreatePostDto) {
    return this.postsService.createPost(req.user.id, req.user.username, dto.content, dto.mediaUrls || [], dto.videoId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deletePost(@Param('id') id: string, @Request() req) {
    return this.postsService.deletePost(id, req.user.id);
  }

  // ── Authenticated Interactions (like, repost) ──────────────────────
  // ⚠️ Must be BEFORE :id route — /posts/:id/like would match :id first!
  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  async toggleLike(@Param('id') id: string, @Request() req) {
    return this.postsService.toggleLike(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/repost')
  async repost(@Param('id') id: string, @Request() req) {
    return this.postsService.repost(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/repost')
  async unrepost(@Param('id') id: string, @Request() req) {
    return this.postsService.unrepost(req.user.id, id);
  }

  // ── Pin / Unpin ───────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post(':id/pin')
  async pinPost(@Param('id') id: string, @Request() req) {
    return this.postsService.pinPost(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/pin')
  async unpinPost(@Param('id') id: string, @Request() req) {
    return this.postsService.unpinPost(id, req.user.id);
  }

  // ⚠️ Must be BEFORE :id route — /posts/:id/quote would match :id first!
  @UseGuards(JwtAuthGuard)
  @Post(':id/quote')
  async quotePost(@Param('id') id: string, @Request() req, @Body() body: { content: string }) {
    return this.postsService.quotePost(req.user.id, req.user.username, id, body.content);
  }

  // ── User Likes (posts they liked, shown in profile Likes tab) ──────────
  // ⚠️ Must be BEFORE :id route
  @UseGuards(JwtAuthGuard)
  @Get('user/:username/likes')
  async getUserLikedPosts(@Param('username') username: string, @Request() req, @Query('cursor') cursor?: string) {
    return this.postsService.getUserLikedPosts(username, req.user.id, cursor);
  }

  // ── User Reposts (posts they reposted, shown in profile Reposts tab) ─
  // ⚠️ Must be BEFORE :id route
  @UseGuards(JwtAuthGuard)
  @Get('user/:username/reposts')
  async getUserReposts(@Param('username') username: string, @Request() req, @Query('cursor') cursor?: string) {
    return this.postsService.getUserReposts(username, req.user.id, cursor);
  }

  // ── Comments ───────────────────────────────────────────────────────────
  // ⚠️ Must be BEFORE :id route
  @UseGuards(JwtAuthGuard)
  @Get(':id/comments')
  async getComments(@Param('id') id: string, @Query('cursor') cursor?: string) {
    return this.postsService.getComments(id, cursor);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/comment')
  async createComment(@Param('id') id: string, @Request() req, @Body() body: { content: string }) {
    return this.postsService.createComment(req.user.id, req.user.username, id, body.content);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('comments/:commentId')
  async deleteComment(@Param('commentId') commentId: string, @Request() req) {
    return this.postsService.deleteComment(commentId, req.user.id);
  }

  // ── Thread / Replies ─────────────────────────────────────────────────
  // GET /posts/:id/thread — all nested replies for a post
  @UseGuards(JwtAuthGuard)
  @Get(':id/thread')
  async getThread(@Param('id') id: string, @Request() req) {
    return this.postsService.getThread(id, req.user?.id);
  }

  // POST /posts/:id/reply — create a reply (nested post)
  @UseGuards(JwtAuthGuard)
  @Post(':id/reply')
  async createReply(@Param('id') id: string, @Request() req, @Body() body: { content: string }) {
    return this.postsService.createReply(req.user.id, req.user.username, id, body.content);
  }

  // ── Public Single Post GET ─────────────────────────────────────────
  // ⚠️ MUST be LAST — wildcard :id matches everything else
  @Get(':id')
  async getPost(@Param('id') id: string, @Request() req) {
    return this.postsService.getPost(id, req.user?.id);
  }
}
