import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { VideoModule } from '../video/video.module';

@Module({
  controllers: [UploadController],
  providers: [UploadService],
  imports: [VideoModule],
})
export class UploadModule {}
