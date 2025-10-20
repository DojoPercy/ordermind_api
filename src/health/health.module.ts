import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../database/prisma.module';

import { HealthController } from './health.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [HealthController],
})
export class HealthModule {}
