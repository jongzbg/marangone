import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp');

export interface AvatarSizes {
  thumb: string;   // 200x200 crop, quality 65, webp
  medium: string;   // 800px max, quality 75, webp
  full: string;     // 1600px max, quality 85, webp
}

@Injectable()
export class UploadService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');
  private readonly avatarDir = path.join(this.uploadDir, 'avatars');

  ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    if (!fs.existsSync(this.avatarDir)) {
      fs.mkdirSync(this.avatarDir, { recursive: true });
    }
  }

  async processAvatar(file: Express.Multer.File): Promise<AvatarSizes> {
    this.ensureUploadDir();

    const uuid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const base = path.join(this.avatarDir, uuid);

    const image = sharp(file.buffer);

    // thumb: 200x200 crop center, quality 65, webp
    await image
      .clone()
      .resize(200, 200, { fit: 'cover', position: 'centre' })
      .webp({ quality: 65 })
      .toFile(`${base}-thumb.webp`);

    // medium: 800px max width/height, quality 75, webp
    await image
      .clone()
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(`${base}-medium.webp`);

    // full: 1600px max width/height, quality 85, webp
    await image
      .clone()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(`${base}-full.webp`);

    return {
      thumb: `/uploads/avatars/${uuid}-thumb.webp`,
      medium: `/uploads/avatars/${uuid}-medium.webp`,
      full: `/uploads/avatars/${uuid}-full.webp`,
    };
  }

  async saveFile(file: Express.Multer.File, baseUrl?: string): Promise<string> {
    this.ensureUploadDir();
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const filepath = path.join(this.uploadDir, filename);
    fs.writeFileSync(filepath, file.buffer);
    const host = baseUrl || `http://localhost:3001`;
    return `${host}/uploads/${filename}`;
  }
}
