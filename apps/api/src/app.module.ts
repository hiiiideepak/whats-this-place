import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AroundModule } from './around/around.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    HealthModule,
    AroundModule,
  ],
})
export class AppModule {}
