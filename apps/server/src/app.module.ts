import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TrpcModule } from './trpc/trpc.module';
import { AIChatbotService } from './services/ai-chatbot.service';

@Module({
  imports: [ConfigModule.forRoot({envFilePath:'../../.env'}),TrpcModule],
  controllers: [AppController],
  providers: [AppService, AIChatbotService],
})
export class AppModule {}
