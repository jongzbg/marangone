import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HashtagsService {
  constructor(private prisma: PrismaService) {}

  async getPostsByHashtag(tag: string, type: 'popular' | 'latest' | 'following', userId?: string) {
    const decodedTag = decodeURIComponent(tag);

    const posts = await this.prisma.post.findMany({
      where: {
        content: { contains: `#${decodedTag}`, mode: 'insensitive' },
        deletedAt: null,
        parentId: null,
      },
      orderBy:
        type === 'popular'
          ? { likesCount: 'desc' }
          : { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        _count: { select: { likes: true, replies: true, reposts: true } },
      },
    });

    if (type === 'following' && userId) {
      const following = await this.prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      });
      const followingIds = new Set(following.map(f => f.followingId));
      const filtered = posts.filter(p => followingIds.has(p.userId));
      return this.enrichPosts(filtered, userId);
    }

    return this.enrichPosts(posts, userId);
  }

  async getTrendingHashtags() {
    // Find top 5 hashtags by post count in last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const posts = await this.prisma.post.findMany({
      where: {
        createdAt: { gte: yesterday },
        deletedAt: null,
        parentId: null,
      },
      select: { content: true },
    });

    // Extract hashtags and count
    const tagCounts = new Map<string, number>();
    const hashtagRegex = /#([฀-๿\w]+)/g;

    for (const post of posts) {
      let match;
      while ((match = hashtagRegex.exec(post.content)) !== null) {
        const tag = match[1].toLowerCase();
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // Sort by count and take top 5
    const sorted = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return sorted.map(([tag, count]) => ({
      tag,
      postsCount: count,
    }));
  }

  private async enrichPosts(posts: any[], userId?: string) {
    if (posts.length === 0) return [];

    const postIds = posts.map(p => p.id);
    const [likes, reposts, replyCounts] = await Promise.all([
      userId
        ? this.prisma.like.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } })
        : Promise.resolve([]),
      userId
        ? this.prisma.repost.findMany({
            where: { userId, postId: { in: postIds } },
            select: { postId: true, user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
          })
        : Promise.resolve([]),
      this.prisma.post.groupBy({
        by: ['parentId'],
        where: { parentId: { in: postIds }, deletedAt: null },
        _count: { parentId: true },
      }),
    ]);

    const likedSet = new Set(likes.map(l => l.postId));
    const repostedMap = new Map(reposts.map(r => [r.postId, r.user]));
    const replyCountMap = new Map(replyCounts.map(r => [r.parentId!, r._count.parentId]));

    return posts.map(p => ({
      ...p,
      isLiked: likedSet.has(p.id),
      isReposted: repostedMap.has(p.id),
      likesCount: p._count.likes,
      commentsCount: replyCountMap.get(p.id) ?? 0,
      repostsCount: p._count.reposts,
      repostedBy: repostedMap.has(p.id)
        ? { id: repostedMap.get(p.id)!.id, username: repostedMap.get(p.id)!.username, displayName: repostedMap.get(p.id)!.displayName, avatarUrl: repostedMap.get(p.id)!.avatarUrl }
        : undefined,
    }));
  }
}