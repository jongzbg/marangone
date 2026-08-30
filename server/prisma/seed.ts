import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const password = await bcrypt.hash('password123', 10);

  const alice = await prisma.user.upsert({
    where: { username: 'alice' },
    update: {},
    create: {
      email: 'alice@example.com',
      username: 'alice',
      name: 'Alice',
      displayName: 'Alice',
      password,
      bio: 'Hello, I am Alice!',
    },
  });

  const bob = await prisma.user.upsert({
    where: { username: 'bob' },
    update: {},
    create: {
      email: 'bob@example.com',
      username: 'bob',
      name: 'Bob',
      displayName: 'Bob',
      password,
      bio: 'Hey there!',
    },
  });

  const charlie = await prisma.user.upsert({
    where: { username: 'charlie' },
    update: {},
    create: {
      email: 'charlie@example.com',
      username: 'charlie',
      name: 'Charlie',
      displayName: 'Charlie',
      password,
      bio: 'Just a chill dude',
    },
  });

  console.log(`✅ Created users: alice, bob, charlie (password: password123)`);

  // Alice posts
  const post1 = await prisma.post.create({
    data: {
      userId: alice.id,
      username: alice.username,
      content: 'Hello world! This is my first post on Nexus! 🎉',
    } as Prisma.PostUncheckedCreateInput,
  });

  const post2 = await prisma.post.create({
    data: {
      userId: alice.id,
      username: alice.username,
      content: 'Just testing out the Nexus social platform. What do you think?',
    } as Prisma.PostUncheckedCreateInput,
  });

  // Bob posts
  const post3 = await prisma.post.create({
    data: {
      userId: bob.id,
      username: bob.username,
      content: 'Great to be here! Looking forward to connecting with everyone.',
    } as Prisma.PostUncheckedCreateInput,
  });

  // Charlie posts
  const post4 = await prisma.post.create({
    data: {
      userId: charlie.id,
      username: charlie.username,
      content: 'Random thought of the day: Coffee is the best invention ever ☕',
    } as Prisma.PostUncheckedCreateInput,
  });

  console.log(`✅ Created 4 posts`);

  // Follows
  await prisma.follow.createMany({
    data: [
      { followerId: bob.id, followingId: alice.id },
      { followerId: charlie.id, followingId: alice.id },
      { followerId: charlie.id, followingId: bob.id },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Created follow relationships`);

  // Likes
  await prisma.like.createMany({
    data: [
      { userId: bob.id, postId: post1.id },
      { userId: charlie.id, postId: post1.id },
      { userId: alice.id, postId: post3.id },
    ],
    skipDuplicates: true,
  });

  await prisma.post.update({ where: { id: post1.id }, data: { likesCount: 2 } });
  await prisma.post.update({ where: { id: post3.id }, data: { likesCount: 1 } });

  console.log(`✅ Created likes`);
  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
