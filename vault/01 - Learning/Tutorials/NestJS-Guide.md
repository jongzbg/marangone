# NestJS Quick Guide

## What is NestJS?

A progressive Node.js framework for building efficient, scalable server-side applications. Uses TypeScript, follows modular architecture.

## Project Setup

```bash
npm i -g @nestjs/cli
nest new project-name
cd project-name
npm run start:dev
```

## Module Structure

```
src/
├── module-name/
│   ├── module-name.controller.ts
│   ├── module-name.service.ts
│   ├── dto/
│   │   └── create.dto.ts
│   └── entities/
│       └── item.entity.ts
├── app.module.ts
└── main.ts
```

## Basic CRUD Example

### 1. Create DTO

```typescript
// posts/dto/create-post.dto.ts
export class CreatePostDto {
  content: string;
  mediaUrls?: string[];
}
```

### 2. Create Service

```typescript
// posts/posts.service.ts
@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePostDto, userId: string) {
    return this.prisma.post.create({
      data: { ...dto, userId },
    });
  }

  async findAll() {
    return this.prisma.post.findMany();
  }

  async findOne(id: string) {
    return this.prisma.post.findUnique({ where: { id } });
  }
}
```

### 3. Create Controller

```typescript
// posts/posts.controller.ts
@Controller('posts')
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreatePostDto, @Request() req) {
    return this.postsService.create(dto, req.user.id);
  }

  @Get()
  findAll() {
    return this.postsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(id);
  }
}
```

### 4. Register Module

```typescript
// posts/posts.module.ts
@Module({
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}

// app.module.ts
@Module({
  imports: [PostsModule],
})
export class AppModule {}
```

## Authentication with JWT

### 1. Setup Passport

```typescript
// auth/jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    return { id: payload.sub, email: payload.email };
  }
}
```

### 2. Use Guard in Controller

```typescript
@Get('protected')
@UseGuards(JwtAuthGuard)
getProtectedData(@Request() req) {
  return req.user; // { id: "...", email: "..." }
}
```

## Prisma Integration

### 1. Setup

```bash
npm install prisma @prisma/client
npx prisma init
```

### 2. Define Schema

```prisma
// prisma/schema.prisma
model Post {
  id        String   @id @default(cuid())
  content   String
  createdAt DateTime @default(now())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
}
```

### 3. Generate & Migrate

```bash
npx prisma generate
npx prisma migrate dev
```

### 4. Use in Service

```typescript
@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreatePostDto) {
    return this.prisma.post.create({ data });
  }
}
```

## Common Decorators

| Decorator | Purpose |
|-----------|---------|
| `@Controller()` | Define route prefix |
| `@Get()`, `@Post()`, `@Put()`, `@Delete()` | HTTP methods |
| `@Param()`, `@Query()`, `@Body()` | Request data |
| `@Request()` | Full request object |
| `@UseGuards()` | Apply auth guard |
| `@Inject()` | Dependency injection |

## Useful Commands

```bash
npm run start:dev    # Development mode
npm run build        # Build for production
npm run start:prod   # Run production build
npx prisma studio    # Database GUI
npx prisma migrate   # Run migrations
```

## NestJS Concepts

1. **Modules** - Organize code into features
2. **Controllers** - Handle HTTP requests
3. **Providers/Services** - Business logic
4. **Guards** - Authentication/Authorization
5. **Interceptors** - Transform responses
6. **Pipes** - Data validation