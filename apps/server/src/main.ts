import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TrpcRouter } from './trpc/trpc.router';
import * as Mongoose from 'mongoose';

async function bootstrap() {
  Mongoose.set('strictQuery', false);
  await Mongoose.connect(process.env.MONGO_DB!);
  console.log("connected to DB.");
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const trpc = app.get(TrpcRouter);
  trpc.applyMiddleware(app);
  await app.listen(process.env.PORT ?? 3001,'0.0.0.0');
}
bootstrap();
