import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

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

  // Swagger API Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('OrderMind POS API')
    .setDescription(
      `
      OrderMind POS API with keyset (cursor-based) pagination.
      
      **Pagination:**
      - Use \`limit\` query parameter (1-100, default: 20)
      - Use \`cursor\` query parameter for next page (from pageInfo.endCursor)
      - Use \`orderBy\` query parameter ('asc' or 'desc', default: 'desc')
      
      **Example:**
      \`GET /api/v1/users?limit=20&orderBy=desc\`
      \`GET /api/v1/users?limit=20&cursor=eyJpZCI6IjEyMyJ9&orderBy=desc\`
      
      **Getting Started:**
      1. Get your Auth0 access token from Postman or Auth0
      2. Click "Authorize" button below and paste your token
      3. Test any endpoint directly from this page!
      
      **Authentication Flow:**
      - First time users: Create organization with POST /organizations
      - Logout & login again to get token with org_id claim
      - Then create branches and invite users
    `,
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description:
          'Enter your Auth0 access token (get it from OAuth 2.0 flow or Postman)',
        in: 'header',
      },
      'Auth0',
    )
    .addTag('Auth', 'Authentication and user profile')
    .addTag('Organizations', 'Organization management')
    .addTag('Branches', 'Branch (restaurant location) management')
    .addTag('Users', 'User invitations and member management')
    .addTag('Health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'OrderMind API Docs',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .scheme-container { background: #fafafa; padding: 20px; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = configService.port;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`🌍 Environment: ${configService.nodeEnv}`);
  console.log(`📚 API Prefix: ${apiPrefix || 'none'}`);
  console.log(`📖 Swagger Docs: http://localhost:${port}/api-docs`);
}

bootstrap().catch((error) => {
  console.error('❌ Application failed to start:', error);
  process.exit(1);
});
