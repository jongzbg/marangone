import { Controller, Post, UseGuards, UseInterceptors,
  UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadService } from './upload.service';
import { VideoService } from '../video/video.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync, copyFileSync } from 'fs';

// ── Video upload storage ──────────────────────────────────────────────────────
const VIDEO_TEMP_DIR = './storage/videos/temp';
const videoStorage = diskStorage({
  destination: (_req, _file, cb) => {
    if (!existsSync(VIDEO_TEMP_DIR)) mkdirSync(VIDEO_TEMP_DIR, { recursive: true });
    cb(null, VIDEO_TEMP_DIR);
  },
  filename: (_req, file, cb) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const ext = extname(file.originalname) || '.mp4';
    cb(null, `${tempId}${ext}`);
  },
});

const videoFileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  const allowed = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/ogg',
  ];
  if (!allowed.includes(file.mimetype)) {
    return cb(
      new BadRequestException(
        'Only video files (mp4, webm, mov) are allowed',
      ),
      false,
    );
  }
  cb(null, true);
};

// ── Image upload storage ──────────────────────────────────────────────────────
const imageFileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (
    !file.mimetype.startsWith('image/') &&
    !file.mimetype.startsWith('video/')
  ) {
    return cb(
      new BadRequestException('Only image/video files are allowed'),
      false,
    );
  }
  cb(null, true);
};

// ── Avatar upload storage ────────────────────────────────────────────────────
const avatarFileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new BadRequestException('Only image files are allowed'), false);
  }
  cb(null, true);
};

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private uploadService: UploadService,
    private videoService: VideoService,
  ) {}

  // ── Video ──────────────────────────────────────────────────────────────────
  @Post('video')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max (Multer hard limit)
      storage: videoStorage,
      fileFilter: videoFileFilter,
    }),
  )
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');

    // ── Phase 5.2: Enforce 10MB soft limit on video uploads ──────────────────
    const MAX_VIDEO_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_VIDEO_SIZE) {
      // Clean up the temp file we just wrote
      const { unlinkSync } = require('fs');
      try { unlinkSync(file.path); } catch { /* ignore */ }
      throw new BadRequestException(
        `ไฟล์มีขนาด ${(file.size / 1024 / 1024).toFixed(1)}MB เกินขนาดสูงสุด 10MB กรุณาเลือกไฟล์ที่เล็กกว่า`,
      );
    }

    // Register video in DB, returns videoId
    const videoId = await this.videoService.registerUpload(file.path, file.filename);
    return {
      videoId,
      // Correct: /videos/temp matches static serving in main.ts
      originalUrl: `/videos/temp/${file.filename}`,
      status: 'pending',
      size: file.size,
    };
  }

  // ── Image ──────────────────────────────────────────────────────────────────
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: imageFileFilter,
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const url = await this.uploadService.saveFile(file);
    return { url };
  }

  // ── Avatar ─────────────────────────────────────────────────────────────────
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: avatarFileFilter,
    }),
  )
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const sizes = await this.uploadService.processAvatar(file);
    return { ...sizes };
  }
}
