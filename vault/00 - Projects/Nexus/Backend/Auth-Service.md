# Auth Service

Authentication service handling user registration, login, and JWT token management.

## Methods

### register

Create a new user account.

```typescript
async register(
  email: string,
  password: string,
  username: string,
  displayName: string
): Promise<{ user: User; token: string }>
```

**Process:**
1. Check if email/username already exists
2. Hash password with bcrypt (10 rounds)
3. Create user in database
4. Generate JWT token
5. Return user + token

**Errors:**
- `ConflictException` if email/username already taken

---

### login

Authenticate user and return token.

```typescript
async login(email: string, password: string): Promise<{ user: User; token: string }>
```

**Process:**
1. Find user by email
2. Verify password with bcrypt
3. Generate JWT token
4. Return user + token

**Errors:**
- `UnauthorizedException` if email not found or password invalid

---

### me

Get current authenticated user's profile.

```typescript
async me(userId: string): Promise<UserProfile>
```

**Returns:**
```typescript
{
  id: string
  email: string
  username: string
  name: string
  displayName: string
  avatarUrl: string | null
  bannerUrl: string | null
  bio: string | null
  location: string | null
  website: string | null
  createdAt: Date
  followersCount: number
  followingCount: number
  postsCount: number
}
```

---

### generateToken (private)

Generate JWT token for user.

```typescript
private generateToken(userId: string): string
```

**JWT Payload:**
```json
{ "sub": "<userId>" }
```

---

## Password Security

- Passwords hashed with **bcrypt** (10 salt rounds)
- Never stored in plaintext
- Compared using `bcrypt.compare()`

## Related Files

- `server/src/auth/auth.service.ts`
- `server/src/auth/auth.controller.ts`
- `server/src/auth/strategies/jwt.strategy.ts`
- `server/src/auth/guards/jwt-auth.guard.ts`