import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth';
import { BranchesModule } from './branches';
import { CommonModule } from './common/common.module';
import { ConfigModule, ConfigService } from './config';
import { PrismaModule } from './database';
import { HealthModule } from './health';
import { MonitoringModule } from './monitoring/monitoring.module';
import { OrganizationsModule } from './organizations';
import { UsersModule } from './users';

@Module({
  imports: [
    CommonModule,
    ConfigModule,
    PrismaModule,
    HealthModule,
    MonitoringModule,
    AuthModule,
    OrganizationsModule,
    BranchesModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService, ConfigService],
  exports: [ConfigService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
