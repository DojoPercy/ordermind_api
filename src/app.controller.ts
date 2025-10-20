import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { AppService } from './app.service';
import { ConfigService } from './config';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Welcome message',
    description: 'Returns a welcome message for the API',
  })
  @ApiResponse({ status: 200, description: 'Welcome message' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('config')
  @ApiOperation({
    summary: 'Get API configuration',
    description: 'Returns current API configuration (non-sensitive data only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration retrieved',
  })
  getConfig() {
    return {
      environment: this.configService.nodeEnv,
      port: this.configService.port,
      features: this.configService.featuresConfig,
      api: {
        prefix: this.configService.apiConfig.prefix,
        rateLimit: this.configService.apiConfig.rateLimit,
      },
    };
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns API health status and uptime',
  })
  @ApiResponse({
    status: 200,
    description: 'API is healthy',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2025-10-14T02:28:16.137Z',
        environment: 'development',
        uptime: 123.456,
      },
    },
  })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: this.configService.nodeEnv,
      uptime: process.uptime(),
    };
  }
}
