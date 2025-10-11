import { Controller, Get } from '@nestjs/common';

import { AppService } from './app.service';
import { ConfigService } from './config';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('config')
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
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: this.configService.nodeEnv,
      uptime: process.uptime(),
    };
  }
}
