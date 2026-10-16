import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import * as express from 'express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const expressApp = app.getHttpAdapter().getInstance();

// CORS for API routes
  expressApp.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  // Temp video uploads (raw, no-cache — use only while encoding)
  expressApp.use('/videos/temp', express.static(path.join(process.cwd(), 'storage/videos/temp'), {
    maxAge: 0,
    index: false,
  }));
  // Encoded video output (immutable, long-cache — ready to serve)
  expressApp.use('/videos', express.static(path.join(process.cwd(), 'storage/videos/output'), {
    maxAge: '1y',
    immutable: true,
    index: false,
  }));

  // CORS for API routes
  const allowedOrigins = [
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Increase body size limit for large image uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Nexus API running on http://localhost:${port}`);
}

bootstrap();