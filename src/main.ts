import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ConfigService } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get configuration service
  const configService = app.get(ConfigService);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Set global prefix
  const apiPrefix = configService.apiConfig.prefix;
  if (apiPrefix) {
    app.setGlobalPrefix(apiPrefix);
  }

  // CORS configuration
  const corsConfig = configService.corsConfig;
  app.enableCors({
    origin: corsConfig.origin,
    credentials: corsConfig.credentials,
  });

  const port = configService.port;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`🌍 Environment: ${configService.nodeEnv}`);
  console.log(`📚 API Prefix: ${apiPrefix || 'none'}`);
}

bootstrap().catch((error) => {
  console.error('❌ Application failed to start:', error);
  process.exit(1);
});
