# การโพสต์รูปภาพ — Nexus Social

## ภาพรวม

Nexus Social รองรับการแนบรูปภาพและวิดีโอในโพสต์ รวมถึง avatar และ banner ของโปรไฟล์

---

## 📏 ขนาดไฟล์

- **ขนาดสูงสุดต่อรูป:** 10MB
- ตั้งไว้ที่ `upload.controller.ts` ใน FileInterceptor: `limits: { fileSize: 10 * 1024 * 1024 }`
- Error ที่เกิด: `413 Payload Too Large`

### Error 413 เกิดจากอะไร?

- **มาจาก NestJS** ที่ตั้ง limit 10MB ใน FileInterceptor
- ไม่ใช่ nginx เพราะไม่มี nginx รันอยู่
- express.json ตั้งไว้ 50MB แต่ multer intercept ก่อน

---

## 🔢 จำนวนรูปภาพต่อโพสต์

- **สูงสุด 4 รูป** ต่อ 1 โพสต์
- ตรวจสอบที่ `PostComposer.tsx` ใน handleFileSelect

| จำนวน | สัดส่วนที่แสดง |
|--------|---------------|
| 1 รูป | แสดงเต็มความกว้าง สูงสุด 400px |
| 2 รูป | grid 2 คอลัมน์ เท่ากัน |
| **3 รูป** | ซ้าย 1 รูปใหญ่ + ขวา 2 รูปย่อยเรียงบน-ล่าง |
| 4 รูป | grid 2x2 |

> ⚠️ layout 3 รูปต้องสมมุติเหมือนกันทั้ง PostComposer (preview) และ PostCard (แสดงผลจริง)

---

## 📁 ประเภทไฟล์ที่รองรับ

| ประเภท | MIME types | accept attribute |
|---------|------------|-----------------|
| รูปภาพ | image/* | `image/*` |
| วิดีโอ | mp4, webm, mov | `video/*` |

---

## ⚠️ เงื่อนไขการเลือกรูป

### 1. ขนาดเกิน 10MB
- **ข้อความแจ้งเตือน:** "ไฟล์มีขนาดใหญ่เกิน 10MB กรุณาเลือกไฟล์ที่เล็กกว่า"
- แสดงใน `PostComposer.tsx` และ `edit-profile/page.tsx`
- Error เคลียร์เมื่อเลือกไฟล์ใหม่

### 2. เลือกเกิน 4 รูป
- **ข้อความแจ้งเตือน:** "โปรดเลือกรูปภาพ วิดีโอ สูงสุด 4 รายการ"
- ตรวจสอบที่ `handleFileSelect` ใน `PostComposer.tsx`
- File input ถูกเคลียร์เมื่อเกิน limit

---

## 🗂️ ไฟล์ที่เกี่ยวข้อง

### Backend (NestJS)
| ไฟล์ | หน้าที่ |
|------|---------|
| `server/src/upload/upload.controller.ts` | รับไฟล์ upload image + avatar, จำกัด 10MB |
| `server/src/main.ts` | ตั้ง express body limit 50MB |

### Frontend (Next.js)
| ไฟล์ | หน้าที่ |
|------|---------|
| `client/src/components/posts/PostComposer.tsx` | เลือกไฟล์, preview, upload และแจ้งเตือน |
| `client/src/components/posts/PostCard.tsx` | แสดงรูปในโพสต์ที่โพสต์แล้ว (layout 3 รูป) |
| `client/src/app/edit-profile/page.tsx` | อัปโหลด avatar และ banner + แจ้งเตือน |
| `client/src/lib/api.ts` | uploadApi.uploadImage() |

---

## 🔧 วิธีเพิ่ม/ลด limit

### เปลี่ยนขนาดสูงสุด
แก้ที่ `server/src/upload/upload.controller.ts` ทั้ง `@Post('image')` และ `@Post('avatar')`:
```typescript
limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
```
เปลี่ยนเป็นค่าที่ต้องการ เช่น `50 * 1024 * 1024` สำหรับ 50MB

### เปลี่ยนจำนวนรูปสูงสุด
แก้ที่ `client/src/components/posts/PostComposer.tsx`:
```typescript
const MAX_MEDIA = 4 // เปลี่ยนจำนวนที่นี่
if (mediaFiles.length + files.length > MAX_MEDIA) { ... }
```

---

## 📝 สรุปการแจ้งเตือน

| กรณี | ข้อความ | ไฟล์ |
|------|---------|------|
| ไฟล์ > 10MB (PostComposer) | "ไฟล์มีขนาดใหญ่เกิน 10MB กรุณาเลือกไฟล์ที่เล็กกว่า" | PostComposer.tsx |
| ไฟล์ > 10MB (Edit Profile) | "ไฟล์มีขนาดใหญ่เกิน 10MB กรุณาเลือกไฟล์ที่เล็กกว่า" | edit-profile/page.tsx |
| เลือกเกิน 4 รูป | "โปรดเลือกรูปภาพ วิดีโอ สูงสุด 4 รายการ" | PostComposer.tsx |
