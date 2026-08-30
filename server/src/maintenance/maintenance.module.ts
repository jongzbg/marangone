import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { CountReconciliationService } from './count-reconciliation.service';
import { MediaIntegrityService } from './media-integrity.service';
import { MaintenanceController } from './maintenance.controller';

@Module({
  imports: [PrismaModule, ScheduleModule],
  controllers: [MaintenanceController],
  providers: [CountReconciliationService, MediaIntegrityService],
  exports: [CountReconciliationService, MediaIntegrityService],
})
export class MaintenanceModule {}
