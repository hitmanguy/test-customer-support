import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TrpcRouter } from './trpc/trpc.router';
import * as Mongoose from 'mongoose';
import { OAuthCallbackLogger } from './middleware/oauth-callback-logger';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  
  const requiredEnvVars = [
    'MONGO_DB', 
    'GOOGLE_CLIENT_ID', 
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => {
    const value = process.env[varName];
    return !value || value.trim() === '';
  });
  
  if (missingVars.length > 0) {
    console.error(`ERROR: Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }
  
  
  console.log('Environment Configuration:');
  console.log(` - GOOGLE_REDIRECT_URI: ${process.env.GOOGLE_REDIRECT_URI}`);
  console.log(` - MONGO_DB: ${process.env.MONGO_DB ? 'Set ✓' : 'Missing ✗'}`);
  console.log(` - GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? 'Set ✓' : 'Missing ✗'}`);

  Mongoose.set('strictQuery', false);
  await Mongoose.connect(process.env.MONGO_DB!);
  console.log("Connected to MongoDB successfully.");
  const app = await NestFactory.create(AppModule);
  app.use((req: Request, res: Response, next: NextFunction) => {
    try {
      const oauthLogger = new OAuthCallbackLogger();
      oauthLogger.use(req, res, next);
    } catch (error) {
      console.error('Error in OAuth callback logger:', error);
      next(); 
    }
  });
  
  app.enableCors({
    origin: ['http://localhost:3000', 'https://accounts.google.com', `https://${process.env.VERCEL_URL1}`],
    credentials: true
  });
  
  const trpc = app.get(TrpcRouter);
  trpc.applyMiddleware(app);
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
  
  console.log(`Server running on port ${process.env.PORT ?? 3001}`);
}

bootstrap()