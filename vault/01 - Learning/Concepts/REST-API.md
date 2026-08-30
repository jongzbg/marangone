# REST API Concepts

## What is REST?

**Representational State Transfer** - An architectural style for designing networked applications.

## HTTP Methods

| Method | Purpose | Example |
|--------|---------|---------|
| GET | Read data | `GET /users` |
| POST | Create new | `POST /users` |
| PUT | Full update | `PUT /users/1` |
| PATCH | Partial update | `PATCH /users/1` |
| DELETE | Remove | `DELETE /users/1` |

## REST Conventions

### Resource Naming

```
# Good
GET    /posts
GET    /posts/123
POST   /posts
PUT    /posts/123
DELETE /posts/123

# Bad
GET /getPosts
GET /fetchPostById?id=123
POST /createNewPost
```

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK (Success) |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Server Error |

## REST in NestJS

### Controller Example

```typescript
@Controller('posts')
export class PostsController {
  @Get()           // GET /posts
  findAll() { }

  @Get(':id')     // GET /posts/123
  findOne(@Param('id') id: string) { }

  @Post()         // POST /posts
  create(@Body() dto: CreatePostDto) { }

  @Patch(':id')   // PATCH /posts/123
  update(@Param('id') id: string, @Body() dto: UpdatePostDto) { }

  @Delete(':id')  // DELETE /posts/123
  delete(@Param('id') id: string) { }
}
```

## Authentication

### Bearer Token

```bash
# Request with token
GET /api/users/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server extracts token
const token = req.headers.authorization?.split(' ')[1]
```

### JWT Flow

```
1. User logs in → Server returns JWT
2. Client stores JWT (localStorage/cookie)
3. Client sends JWT in Authorization header
4. Server validates JWT, extracts user info
5. Server returns user-specific data
```

## Query Parameters

```typescript
// GET /posts?page=1&limit=10
@Get()
findAll(@Query('page') page: string, @Query('limit') limit: string) {
  const pageNum = parseInt(page) || 1
  const limitNum = parseInt(limit) || 10
  return this.postsService.findAll({ page: pageNum, limit: limitNum })
}

// GET /posts?search=hello&sort=createdAt
@Get()
findAll(@Query() query: { search?: string; sort?: string }) {
  return this.postsService.search(query)
}
```

## Request Body

```typescript
// POST /posts
// Body: { "content": "Hello", "mediaUrls": [] }
@Post()
create(@Body() dto: CreatePostDto) {
  return this.postsService.create(dto)
}
```

## Nested Resources

```
GET  /users/123/posts          # All posts by user 123
GET  /users/123/posts/456       # Post 456 by user 123
POST /users/123/posts           # Create post for user 123
```

In NestJS:
```typescript
@Controller('users/:userId/posts')
export class UserPostsController {
  @Get()
  findByUser(@Param('userId') userId: string) { }

  @Get(':postId')
  findOne(@Param('userId') userId: string, @Param('postId') postId: string) { }
}
```

## REST vs GraphQL

| Aspect | REST | GraphQL |
|--------|------|---------|
| Data fetching | Multiple endpoints | Single query |
| Over-fetching | Common | Avoided |
| Caching | HTTP cache | Custom |
| Learning curve | Easier | Steeper |