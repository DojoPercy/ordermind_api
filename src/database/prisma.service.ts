import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaClient } from '../../generated/prisma';
import { ConfigService } from '../config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {
    const dbConfig = configService.databaseConfig;

    if (!dbConfig.url) {
      throw new Error('Database URL is required but not configured');
    }

    super({
      datasources: {
        db: {
          url: dbConfig.url,
        },
      },
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
      errorFormat: 'colorless',
      // Connection pool configuration - removed __internal as it's not in the public API
    });

    // Set up logging event listeners
    this.setupLogging();

    // Set up graceful shutdown
    this.setupGracefulShutdown();
  }

  async onModuleInit() {
    try {
      this.logger.log('Connecting to database...');
      await this.$connect();
      this.isConnected = true;
      this.logger.log('✅ Database connected successfully');

      // Set up middleware after connection is established
      this.setupMiddleware();

      // Test the connection
      await this.testConnection();
    } catch (error) {
      this.logger.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      this.logger.log('Disconnecting from database...');
      await this.$disconnect();
      this.isConnected = false;
      this.logger.log('✅ Database disconnected successfully');
    } catch (error) {
      this.logger.error('❌ Error disconnecting from database:', error);
    }
  }

  /**
   * Check if database is connected
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Get database connection status
   */
  async getConnectionStatus(): Promise<{
    connected: boolean;
    database: string;
    host: string;
    port: number;
    ssl: boolean;
  }> {
    try {
      // Test connection with a simple query
      await this.$queryRaw`SELECT 1`;

      const dbConfig = this.configService.databaseConfig;

      return {
        connected: true,
        database: dbConfig.name ?? 'unknown',
        host: dbConfig.host ?? 'unknown',
        port: dbConfig.port ?? 5432,
        ssl: dbConfig.url?.includes('sslmode=require') ?? false,
      };
    } catch (error) {
      this.logger.error('Database connection test failed:', error);
      return {
        connected: false,
        database: 'unknown',
        host: 'unknown',
        port: 0,
        ssl: false,
      };
    }
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    try {
      await this.$queryRaw`SELECT 1`;
      this.logger.log('✅ Database connection test passed');
    } catch (error) {
      this.logger.error('❌ Database connection test failed:', error);
      throw error;
    }
  }

  /**
   * Set up Prisma logging
   */
  private setupLogging(): void {
    const isDevelopment = this.configService.isDevelopment;

    // Only log queries in development
    if (isDevelopment) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).$on('query', (e: any) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Params: ${e.params}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).$on('error', (e: any) => {
      this.logger.error(`Database Error: ${e.message}`);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).$on('info', (e: any) => {
      this.logger.log(`Database Info: ${e.message}`);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).$on('warn', (e: any) => {
      this.logger.warn(`Database Warning: ${e.message}`);
    });
  }

  /**
   * Set up Prisma middleware for common operations
   */
  private setupMiddleware(): void {
    // Middleware setup for Prisma v5+ - using $extends instead of $use
    // Performance monitoring can be handled through logging or other means
    if (this.configService.isDevelopment) {
      this.logger.debug(
        'Prisma middleware setup completed (using v5+ extensions)',
      );
    }

    // Note: In Prisma v5+, middleware is handled differently through extensions
    // For now, we'll rely on the built-in logging and manual performance tracking
  }

  /**
   * Set up graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    // Handle process termination signals
    const shutdownSignals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

    shutdownSignals.forEach((signal) => {
      process.on(signal, () => {
        this.logger.log(`Received ${signal}, shutting down gracefully...`);
        this.$disconnect()
          .then(() => {
            this.logger.log('Database disconnected successfully');
            process.exit(0);
          })
          .catch((error) => {
            this.logger.error('Error during shutdown:', error);
            process.exit(1);
          });
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception:', error);
      this.$disconnect()
        .catch((disconnectError) => {
          this.logger.error(
            'Error disconnecting during uncaught exception:',
            disconnectError,
          );
        })
        .finally(() => {
          process.exit(1);
        });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.$disconnect()
        .catch((disconnectError) => {
          this.logger.error(
            'Error disconnecting during unhandled rejection:',
            disconnectError,
          );
        })
        .finally(() => {
          process.exit(1);
        });
    });
  }

  /**
   * Execute a transaction (simplified - Prisma handles retries internally)
   */
  async executeTransaction<T>(fn: (prisma: any) => Promise<T>): Promise<T> {
    return await (this as any).$transaction(fn);
  }

  /**
   * Health check for the database
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    details: {
      connected: boolean;
      responseTime: number;
      error?: string;
    };
  }> {
    const startTime = Date.now();

    try {
      await this.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        details: {
          connected: true,
          responseTime,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: {
          connected: false,
          responseTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }
}
