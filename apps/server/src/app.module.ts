import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TrpcModule } from './trpc/trpc.module';
import { PythonAIModule } from './modules/python-ai.module';
import { HealthMonitorModule } from './modules/health-monitor.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env'
    }),
    ScheduleModule.forRoot(),
    PythonAIModule,
    HealthMonitorModule,
    TrpcModule  ],
  controllers: [AppController],
  providers: [
    AppService
  ],
})
export class AppModule {}
