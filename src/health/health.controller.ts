import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { PrismaService } from '../database/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async check() {
    const checks = {
      api: 'ok',
      database: 'unknown',
      auth0: 'unknown',
      timestamp: new Date().toISOString(),
    };

    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    try {
      const domain = this.configService.get<string>('app.auth0.domain');
      const response = await fetch(
        `https://${domain ?? 'unknown'}/.well-known/jwks.json`,
      );
      if (response.ok) {
        checks.auth0 = 'ok';
      } else {
        checks.auth0 = 'error';
      }
    } catch {
      checks.auth0 = 'error';
    }

    return checks;
  }
}
