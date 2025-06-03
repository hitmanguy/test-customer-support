import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TrpcModule } from './trpc/trpc.module';
import { PythonAIModule } from './modules/python-ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env'
    }),
    PythonAIModule,
    TrpcModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
