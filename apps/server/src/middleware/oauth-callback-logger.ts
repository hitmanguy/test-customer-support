/**
 * OAuth Callback Middleware for NestJS
 * 
 * This middleware helps diagnose OAuth callback issues in the application
 * by logging detailed information about incoming OAuth callback requests.
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class OAuthCallbackLogger implements NestMiddleware {  use(req: Request, res: Response, next: NextFunction) {
    try {
      // Only log OAuth callback requests
      if (req.path.includes('/auth/google/callback')) {
        const { code, state, error, error_description } = req.query;
        
        console.log('==== OAUTH CALLBACK REQUEST RECEIVED ====');
        console.log('Timestamp:', new Date().toISOString());
        console.log('URL:', req.url);
        console.log('Path:', req.path);
        console.log('Method:', req.method);
        
        console.log('Query parameters:', {
          hasCode: !!code,
          codeLength: code ? String(code).length : 0,
          hasState: !!state, 
          stateLength: state ? String(state).length : 0,
          error: error || 'none',
          error_description: error_description || 'none'
        });
      
      // Don't log the actual code or state content for security reasons
      
      // Check for request origin
      console.log('Request origin:', {
        referer: req.headers.referer,
        origin: req.headers.origin,
        userAgent: req.headers['user-agent']?.substring(0, 100)
      });
        // Check for cookies (safely)
      try {
        if (req.cookies) {
          console.log('Cookies:', Object.keys(req.cookies));
        } else {
          console.log('Cookies: None found');
        }
      } catch (e) {
        console.log('Cookies: Unable to access');
      }
      
      // Check for session data (safely)
      try {
        const session = (req as any).session;
        if (session) {
          console.log('Session info available:', !!session);
        } else {
          console.log('Session: None found');
        }
      } catch (e) {
        console.log('Session: Unable to access');
      }
      
      console.log('========================================');
    }
      next();
    } catch (error) {
      console.error('Error in OAuth callback logger:', error);
      next(); // Ensure we continue to next middleware even if logging fails
    }
  }
}
