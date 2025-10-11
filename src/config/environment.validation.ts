import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsEnum,
  Min,
  Max,
} from 'class-validator';

export enum NodeEnvironment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TEST = 'test',
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export enum LogFormat {
  DEV = 'dev',
  JSON = 'json',
}

export class EnvironmentVariables {
  // Application
  @IsEnum(NodeEnvironment)
  NODE_ENV!: NodeEnvironment;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT!: number;

  // Database
  @IsString()
  DATABASE_URL!: string;

  @IsString()
  DATABASE_HOST!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(65535)
  DATABASE_PORT!: number;

  @IsString()
  DATABASE_NAME!: string;

  @IsString()
  DATABASE_USER!: string;

  @IsString()
  DATABASE_PASSWORD!: string;

  // Redis
  @IsString()
  REDIS_URL!: string;

  @IsString()
  REDIS_HOST!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(65535)
  REDIS_PORT!: number;

  // JWT
  @IsString()
  JWT_SECRET!: string;

  @IsString()
  JWT_EXPIRATION!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  JWT_REFRESH_EXPIRATION!: string;

  // API
  @IsString()
  API_PREFIX!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  API_RATE_LIMIT!: number;

  // External Services
  @IsString()
  STRIPE_SECRET_KEY!: string;

  @IsString()
  STRIPE_WEBHOOK_SECRET!: string;

  @IsString()
  EMAIL_SERVICE_API_KEY!: string;

  @IsString()
  SMS_SERVICE_API_KEY!: string;

  // Logging
  @IsEnum(LogLevel)
  LOG_LEVEL!: LogLevel;

  @IsEnum(LogFormat)
  LOG_FORMAT!: LogFormat;

  // File Upload
  @Type(() => Number)
  @IsNumber()
  @Min(1024) // Minimum 1KB
  MAX_FILE_SIZE!: number;

  @IsString()
  UPLOAD_PATH!: string;

  // CORS
  @IsString()
  CORS_ORIGIN!: string;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  CORS_CREDENTIALS!: boolean;

  // Security
  @Type(() => Number)
  @IsNumber()
  @Min(4)
  @Max(20)
  BCRYPT_ROUNDS!: number;

  @IsString()
  SESSION_SECRET!: string;

  // Feature Flags
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  ENABLE_SWAGGER!: boolean;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  ENABLE_METRICS!: boolean;

  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  ENABLE_DEBUG_ROUTES!: boolean;
}
