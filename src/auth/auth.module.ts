import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../database/prisma.module';

import { AuthController } from './auth.controller';
import { Auth0ManagementService } from './services/auth0-management.service';
import { Auth0Strategy } from './strategies/auth0.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'auth0' }),
    PrismaModule,
    ConfigModule,
  ],
  providers: [Auth0Strategy, Auth0ManagementService],
  controllers: [AuthController],
  exports: [Auth0ManagementService, PassportModule],
})
export class AuthModule {}
