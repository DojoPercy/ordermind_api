import { registerAs } from '@nestjs/config';

import { NodeEnvironment } from './environment.validation';

export default registerAs('app', () => {
  const env =
    (process.env['NODE_ENV'] as NodeEnvironment) || NodeEnvironment.DEVELOPMENT;

  return {
    // Application
    nodeEnv: env,
    port: parseInt(process.env['PORT'] || '3000', 10),
    isDevelopment: env === NodeEnvironment.DEVELOPMENT,
    isStaging: env === NodeEnvironment.STAGING,
    isProduction: env === NodeEnvironment.PRODUCTION,
    isTest: env === NodeEnvironment.TEST,

    // Database
    database: {
      url: process.env['DATABASE_URL'],
      host: process.env['DATABASE_HOST'],
      port: parseInt(process.env['DATABASE_PORT'] || '5432', 10),
      name: process.env['DATABASE_NAME'],
      user: process.env['DATABASE_USER'],
      password: process.env['DATABASE_PASSWORD'],
    },

    // Redis
    redis: {
      url: process.env['REDIS_URL'],
      host: process.env['REDIS_HOST'],
      port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    },

    // JWT
    jwt: {
      secret: process.env['JWT_SECRET'],
      expiration: process.env['JWT_EXPIRATION'],
      refreshSecret: process.env['JWT_REFRESH_SECRET'],
      refreshExpiration: process.env['JWT_REFRESH_EXPIRATION'],
    },

    // API
    api: {
      prefix: process.env['API_PREFIX'],
      rateLimit: parseInt(process.env['API_RATE_LIMIT'] || '100', 10),
    },

    // External Services
    stripe: {
      secretKey: process.env['STRIPE_SECRET_KEY'],
      webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'],
    },

    email: {
      apiKey: process.env['EMAIL_SERVICE_API_KEY'],
    },

    sms: {
      apiKey: process.env['SMS_SERVICE_API_KEY'],
    },

    // Logging
    logging: {
      level: process.env['LOG_LEVEL'],
      format: process.env['LOG_FORMAT'],
    },

    // File Upload
    upload: {
      maxFileSize: parseInt(process.env['MAX_FILE_SIZE'] || '10485760', 10),
      path: process.env['UPLOAD_PATH'],
    },

    // CORS
    cors: {
      origin: process.env['CORS_ORIGIN']?.split(',') || [],
      credentials: process.env['CORS_CREDENTIALS'] === 'true',
    },

    // Security
    security: {
      bcryptRounds: parseInt(process.env['BCRYPT_ROUNDS'] || '10', 10),
      sessionSecret: process.env['SESSION_SECRET'],
    },

    // Feature Flags
    features: {
      swagger: process.env['ENABLE_SWAGGER'] === 'true',
      metrics: process.env['ENABLE_METRICS'] === 'true',
      debugRoutes: process.env['ENABLE_DEBUG_ROUTES'] === 'true',
    },
  };
});
