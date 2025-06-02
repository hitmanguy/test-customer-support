import { Injectable } from '@nestjs/common';
import { TrpcService } from '../trpc/trpc.service';
import { OAuth2Client } from 'google-auth-library';

// Use the same config as the auth router
const googleOAuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
};

@Injectable()
export class DebugRouter {
  private googleClient: OAuth2Client;
  
  constructor(private readonly trpc: TrpcService) {
    this.googleClient = new OAuth2Client(
      googleOAuthConfig.clientId,
      googleOAuthConfig.clientSecret,
      googleOAuthConfig.redirectUri
    );
  }
  debugRouter = this.trpc.router({
    // Test login bypass (for development and testing only)
    testLogin: this.trpc.procedure
      .input(this.trpc.z.object({
        role: this.trpc.z.enum(['customer', 'agent', 'company']),
        email: this.trpc.z.string().email()
      }))
      .query(async ({ input }) => {
        try {
          console.log('Debug test login requested for:', input);
          
          // This is for testing only, should never be used in production
          const testUser = {
            id: 'test-user-id',
            name: 'Test User',
            email: input.email,
            role: input.role,
            verified: true
          };
          
          // Return a success response with test user
          return {
            success: true,
            token: 'test-token-for-debugging-only',
            user: testUser,
            message: 'TEST LOGIN - NOT FOR PRODUCTION USE'
          };
        } catch (error) {
          console.error('Debug test login error:', error);
          return {
            success: false,
            error: 'Test login failed'
          };
        }
      }),

    // Endpoint to verify Google OAuth configuration
    checkGoogleAuth: this.trpc.procedure
      .query(() => {
        try {
          // Check if Google OAuth config is valid
          const isConfigValid = !!(
            googleOAuthConfig.clientId && 
            googleOAuthConfig.clientSecret && 
            googleOAuthConfig.redirectUri
          );
          
          // Create a real test state object similar to the real one
          const testStateObj = {
            role: 'customer',
            returnTo: '/debug/oauth',
            timestamp: Date.now()
          };
          const testState = Buffer.from(JSON.stringify(testStateObj)).toString('base64');
          
          // Get a test auth URL
          const authUrl = this.googleClient.generateAuthUrl({
            access_type: 'offline',
            scope: [
              'https://www.googleapis.com/auth/userinfo.profile',
              'https://www.googleapis.com/auth/userinfo.email',
            ],
            state: testState,
            client_id: googleOAuthConfig.clientId,
            include_granted_scopes: true
          });          return {
            success: isConfigValid,
            config: {
              env: {
                JWT_SECRET: process.env.JWT_SECRET ? '✓ Set' : '✗ Missing',
                GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '✓ Set' : '✗ Missing',
                GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✓ Set' : '✗ Missing',
                GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI ? '✓ Set' : '✗ Missing',
                NODE_ENV: process.env.NODE_ENV || 'not set'
              },
              stateExample: {
                raw: testState ? testState.substring(0, 20) + '...' : 'Could not generate state',
                length: testState?.length || 0
              },
              clientId: googleOAuthConfig.clientId ?
                `${googleOAuthConfig.clientId.substring(0, 5)}...${googleOAuthConfig.clientId.substring(googleOAuthConfig.clientId.length - 5)}` : 
                'Not set',
              redirectUri: googleOAuthConfig.redirectUri,
              hasClientSecret: !!googleOAuthConfig.clientSecret
            },
            test: {
              authUrl: authUrl || 'Could not generate auth URL'
            },
            environmentVariables: {
              GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
              GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'Not set'
            }
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          };
        }
      })
  });
}


export const { debugRouter } = new DebugRouter(new TrpcService());