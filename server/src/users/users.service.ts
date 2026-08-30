import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}
  async getProfile(username: string, currentUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        bannerUrl: true,
        bio: true,
        location: true,
        website: true,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
          },
        },
        // NOTE: removed posts select — no longer needed (was causing N+1 problem)
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ── SQL aggregation for total likes ─────────────────────────────────────
    // Optimized: SUM(Post.likesCount) instead of loading all posts into RAM
    // Uses denormalized likesCount field which is always in sync (via transactions)
    const likesAggregation = await this.prisma.post.aggregate({
      where: { userId: user.id, deletedAt: null },
      _sum: { likesCount: true },
    });
    const totalLikesReceived = likesAggregation._sum.likesCount ?? 0;

    // ── Likes today (time-based — cannot use denormalized) ─────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const likesToday = await this.prisma.like.count({
      where: {
        post: {
          userId: user.id,
          deletedAt: null,
        },
        createdAt: { gte: todayStart },
      },
    });

    // ── Is following check ─────────────────────────────────────────────────
    let isFollowing = false;
    if (currentUserId) {
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: user.id,
          },
        },
      });
      isFollowing = !!follow;
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      bio: user.bio,
      location: user.location,
      website: user.website,
      createdAt: user.createdAt,
      followersCount: user._count.followers,
      followingCount: user._count.following,
      postsCount: user._count.posts,
      likesCount: totalLikesReceived,
      likesTodayCount: likesToday,
      isFollowing,
    };
  }

  async updateProfile(userId: string, data: {
    displayName?: string;
    bio?: string;
    location?: string;
    website?: string;
    avatarUrl?: string;
    bannerUrl?: string;
  }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bannerUrl: true,
        bio: true,
        location: true,
        website: true,
        createdAt: true,
      },
    });
  }

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new Error('Cannot follow yourself');
    }

    // Check if already following
    const existing = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
    });

    if (existing) {
      return { success: true, message: 'Already following' };
    }

    await this.prisma.follow.create({
      data: {
        followerId,
        followingId,
      },
    });

    // Create notification
    await this.prisma.notification.create({
      data: { type: 'FOLLOW', userId: followingId, actorId: followerId },
    });

    return { success: true, message: 'Followed successfully' };
  }

  async unfollow(followerId: string, followingId: string) {
    await this.prisma.follow.deleteMany({
      where: {
        followerId,
        followingId,
      },
    });

    // Delete the follow notification when unfollowing
    await this.prisma.notification.deleteMany({
      where: {
        type: 'FOLLOW',
        userId: followingId,
        actorId: followerId,
      },
    });

    return { success: true, message: 'Unfollowed successfully' };
  }

  async getFollowers(username: string, currentUserId?: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new NotFoundException('User not found');

    const followers = await this.prisma.follow.findMany({
      where: { followingId: user.id },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            _count: { select: { followers: true, following: true, posts: true } },
          },
        },
      },
    });

    const users = followers.map(f => f.follower);

    // Check if current user follows each user
    let followingMap = new Map<string, boolean>();
    if (currentUserId) {
      const follows = await this.prisma.follow.findMany({
        where: {
          followerId: currentUserId,
          followingId: { in: users.map(u => u.id) },
        },
        select: { followingId: true },
      });
      follows.forEach(f => followingMap.set(f.followingId, true));
    }

    return users.map(u => ({
      ...u,
      isFollowing: followingMap.get(u.id) || false,
      followersCount: u._count.followers,
      followingCount: u._count.following,
      postsCount: u._count.posts,
    }));
  }

  async getFollowing(username: string, currentUserId?: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new NotFoundException('User not found');

    const following = await this.prisma.follow.findMany({
      where: { followerId: user.id },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            _count: { select: { followers: true, following: true, posts: true } },
          },
        },
      },
    });

    const users = following.map(f => f.following);

    // Check if current user follows each user
    let followingMap = new Map<string, boolean>();
    if (currentUserId) {
      const follows = await this.prisma.follow.findMany({
        where: {
          followerId: currentUserId,
          followingId: { in: users.map(u => u.id) },
        },
        select: { followingId: true },
      });
      follows.forEach(f => followingMap.set(f.followingId, true));
    }

    return users.map(u => ({
      ...u,
      isFollowing: followingMap.get(u.id) || false,
      followersCount: u._count.followers,
      followingCount: u._count.following,
      postsCount: u._count.posts,
    }));
  }

  async getTopCreators(limit: number = 10, _currentUserId?: string) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Get users ordered by total likes received on their posts (last 24h)
    const users = await this.prisma.user.findMany({
      take: limit * 3,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        _count: {
          select: {
            followers: true,
            posts: true,
          },
        },
        posts: {
          where: { createdAt: { gte: yesterday } },
          select: {
            _count: {
              select: { likes: true },
            },
          },
        },
      },
    });

    const withLikes = users.map(u => {
      const likesTodayCount = u.posts.reduce((s, p) => s + p._count.likes, 0);
      return {
        ...u,
        likesTodayCount,
      };
    }).filter(u => u.likesTodayCount > 0);
    withLikes.sort((a, b) => b.likesTodayCount - a.likesTodayCount);

    return withLikes.slice(0, limit).map(({ posts, ...rest }) => rest);
  }

  async getMostLiked(limit: number = 10, _currentUserId?: string) {
    // Get all users with all-time likes on all their non-deleted posts
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        _count: {
          select: {
            followers: true,
            posts: true,
          },
        },
        posts: {
          where: { deletedAt: null },
          select: {
            createdAt: true,
            _count: {
              select: { likes: true },
            },
          },
        },
      },
    });

    const withLikes = users.map(u => {
      const likesCount = u.posts.reduce((s, p) => s + p._count.likes, 0);
      // Count likes today
      const likesTodayCount = u.posts.filter(p => {
        return p.createdAt >= yesterday;
      }).reduce((s, p) => s + p._count.likes, 0);
      return {
        ...u,
        likesCount,
        likesTodayCount,
      };
    }).filter(u => u.likesCount > 0);
    withLikes.sort((a, b) => b.likesCount - a.likesCount);

    return withLikes.slice(0, limit).map(({ posts, ...rest }) => rest);
  }

  async searchUsers(query: string, limit: number = 10) {
    if (!query || query.trim().length < 1) {
      return [];
    }

    const searchTerm = query.trim();

    return this.prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: searchTerm, mode: 'insensitive' } },
          { displayName: { contains: searchTerm, mode: 'insensitive' } },
          { name: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      take: limit,
      select: {
        id: true,
        username: true,
        displayName: true,
        name: true,
        avatarUrl: true,
        _count: {
          select: {
            posts: true,
            followers: true,
          },
        },
      },
      orderBy: [
        // Prioritize exact prefix match
        { username: 'asc' },
      ],
    });
  }
}
