import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { plainToClass } from 'class-transformer';
import { validateSync } from 'class-validator';

import configuration from './configuration';
import { EnvironmentVariables } from './environment.validation';

function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map((error) => {
      const constraints = Object.values(error.constraints || {}).join(', ');
      return `${error.property}: ${constraints}`;
    });

    throw new Error(
      `Configuration validation failed:\n${errorMessages.join('\n')}`,
    );
  }

  return validatedConfig;
}

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      // dotenvx handles file loading automatically, no need to specify envFilePath
      expandVariables: true,
      cache: true,
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
