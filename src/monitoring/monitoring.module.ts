import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../database/prisma.module';

import { MonitoringController } from './monitoring.controller';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [MonitoringController],
})
export class MonitoringModule {}
