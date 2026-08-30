# Image Upload

## Overview

Nexus supports image uploads for:
1. **Post images** — Images attached to posts via `mediaUrls`
2. **Profile avatar** — User's profile picture (Sharp-processed into 3 sizes)
3. **Profile banner** — User's profile banner image

## Upload Endpoints

### POST /upload/image

Upload a single image/video file. Used for post media and banner images.

```
POST /upload/image
Content-Type: multipart/form-data
Authorization: Bearer ***
Body: file (binary, max 10MB)
```

**Response:**
```json
{
  "url": "http://localhost:3001/uploads/1234567890-abc.jpg"
}
```

### POST /upload/avatar

Upload and process a profile avatar. Creates 3 WebP sizes via Sharp.

```
POST /upload/avatar
Content-Type: multipart/form-data
Authorization: Bearer ***
Body: file (binary, max 10MB, images only)
```

**Response:**
```json
{
  "thumb": "http://localhost:3001/uploads/avatars/abc-thumb.webp",
  "medium": "http://localhost:3001/uploads/avatars/abc-medium.webp",
  "full": "http://localhost:3001/uploads/avatars/abc-full.webp"
}
```

**Sharp Processing Specs:**
| Size   | Dimensions        | Quality | Format |
|--------|------------------|---------|--------|
| thumb  | 200×200 crop     | 65      | WebP   |
| medium | 800px max        | 75      | WebP   |
| full   | 1600px max       | 85      | WebP   |

**Frontend Flow:**
1. User picks file → `URL.createObjectURL()` shows local preview immediately
2. POST to `/upload/avatar` → server returns `{ thumb, medium, full }`
3. Save `medium` URL as `avatarUrl` in user profile
4. `bannerUrl` uses `/upload/image` endpoint directly

## Frontend Implementation

### Avatar Upload Pattern

```typescript
const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return

  // 1. Show local preview immediately
  const objectUrl = URL.createObjectURL(file)
  setAvatarPreview(objectUrl)

  // 2. Upload to server
  setUploadingAvatar(true)
  const token = localStorage.getItem('token')!
  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await fetch('http://localhost:3001/upload/avatar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const data = await res.json()
    // Save medium size as avatarUrl
    setAvatarUrl(data.medium)
  } catch {
    // Handle error, revoke object URL
    URL.revokeObjectURL(objectUrl)
    setAvatarPreview(null)
  } finally {
    setUploadingAvatar(false)
  }
}
```

### Banner Upload Pattern

```typescript
const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return

  const objectUrl = URL.createObjectURL(file)
  setBannerPreview(objectUrl)

  setUploadingBanner(true)
  const token = localStorage.getItem('token')!
  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await fetch('http://localhost:3001/upload/image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const data = await res.json()
    setBannerUrl(data.url)
  } catch {
    URL.revokeObjectURL(objectUrl)
    setBannerPreview(null)
  } finally {
    setUploadingBanner(false)
  }
}
```

### Post with Images

```typescript
const handleCreatePost = async (content: string, imageFiles: File[]) => {
  // 1. Upload all images first
  const mediaUrls = await Promise.all(
    imageFiles.map(file => uploadImage(file))
  )
  // 2. Create post with media URLs
  await postApi.createPost(content, mediaUrls)
}
```

## Backend Implementation

### Upload Controller

```typescript
// POST /upload/avatar
@Post('avatar')
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      return callback(new BadRequestException('Only image files allowed'), false)
    }
    callback(null, true)
  },
}))
async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
  const sizes = await this.uploadService.processAvatar(file)
  return { ...sizes }
}
```

### Upload Service (Sharp Processing)

```typescript
// ⚠️ Use CommonJS require() instead of ES import for sharp
const sharp = require('sharp')

async processAvatar(file: Express.Multer.File): Promise<AvatarSizes> {
  this.ensureUploadDir()
  const uuid = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const base = path.join(this.avatarDir, uuid)

  const image = sharp(file.buffer)

  // thumb: 200x200 crop center, quality 65, webp
  await image.clone()
    .resize(200, 200, { fit: 'cover', position: 'centre' })
    .webp({ quality: 65 })
    .toFile(`${base}-thumb.webp`)

  // medium: 800px max, quality 75, webp
  await image.clone()
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 75 })
    .toFile(`${base}-medium.webp`)

  // full: 1600px max, quality 85, webp
  await image.clone()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(`${base}-full.webp`)

  const host = 'http://localhost:3001'
  return {
    thumb: `${host}/uploads/avatars/${uuid}-thumb.webp`,
    medium: `${host}/uploads/avatars/${uuid}-medium.webp`,
    full: `${host}/uploads/avatars/${uuid}-full.webp`,
  }
}
```

### Static File Serving

```typescript
// main.ts
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))
```

## File Storage

| Aspect       | Implementation                              |
|--------------|---------------------------------------------|
| Storage      | Local disk (`./uploads/`)                   |
| Avatar dir   | `./uploads/avatars/`                        |
| Naming       | `{timestamp}-{random}.webp`                 |
| Max size     | 10MB                                        |
| Image types  | All image mimetypes (avatar, banner, posts) |
| Avatar types | Images only (banner accepts video too)      |

## Key Pitfalls

1. **Sharp import** — Must use `require('sharp')`, NOT `import sharp from 'sharp'` (CommonJS/ESM incompatibility)
2. **@IsUrl() validator** — DTO's `@IsUrl()` on `avatarUrl`/`bannerUrl` rejects `localhost` URLs → use `@IsString()` instead
3. **Sharp .clone()** — Must clone image before each resize or sharp state gets corrupted

## Related Files
- `server/src/upload/upload.controller.ts`
- `server/src/upload/upload.service.ts`
- `server/src/upload/upload.module.ts`
- `server/src/users/dto/users.dto.ts`
- `client/src/app/edit-profile/page.tsx`
