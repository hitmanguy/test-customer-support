import { OAuth2Client } from 'google-auth-library';
import { Injectable } from '@nestjs/common';

import * as dotenv from 'dotenv';
import * as path from 'path';


(() => {
  
  const serverEnvPath = path.resolve(__dirname, '../../.env');
  const rootEnvPath = path.resolve(__dirname, '../../../../.env');
  
  let result = dotenv.config({ path: serverEnvPath });
  if (result.error) {
    console.log(`No .env file found at ${serverEnvPath}, trying root directory`);
    result = dotenv.config({ path: rootEnvPath });
    if (!result.error) {
      console.log(`Loaded environment variables from ${rootEnvPath}`);
    }
  } else {
    console.log(`Loaded environment variables from ${serverEnvPath}`);
  }
})();

@Injectable()
export class GoogleOAuthHelper {
  
  static createClient(): OAuth2Client {
    try {
      
      const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
      const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
      
      
      if (!clientId || !clientSecret || !redirectUri) {
        const missing = [];
        if (!clientId) missing.push('GOOGLE_CLIENT_ID');
        if (!clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
        if (!redirectUri) missing.push('GOOGLE_REDIRECT_URI');
        
        console.error(`Missing required OAuth configuration: ${missing.join(', ')}`);
        throw new Error(`Missing required OAuth configuration: ${missing.join(', ')}`);
      }

      
      console.log('Google OAuth Config:', { 
        clientId: `${clientId.substring(0, 10)}...`,
        clientSecret: 'Set ✓',
        redirectUri
      });
      
      
      const client = new OAuth2Client({
        clientId,
        clientSecret,
        redirectUri
      });
      
      return client;
    } catch (error) {
      console.error('Failed to create Google OAuth client:', error.message);
      
      return new OAuth2Client({});
    }
  }

  
  static createOAuthClient(): OAuth2Client {
    return this.createClient();
  }

  
  static async exchangeCodeForTokens(client: OAuth2Client, code: string) {
    try {
      
      const response = await client.getToken(code);
      const tokens = response.tokens;
      
      
      if (!tokens || !tokens.id_token) {
        console.error('Invalid token response from Google:', tokens);
        throw new Error('Invalid authentication response from Google');
      }
      
      console.log('Successfully exchanged code for tokens');
      return tokens;
    } catch (error) {
      console.error('Token exchange error:', error.message);
      
      
      if (error.message?.includes('invalid_grant')) {
        throw new Error('Authentication code expired or already used. Please try signing in again.');
      } else if (error.message?.includes('redirect_uri_mismatch')) {
        throw new Error('Redirect URI mismatch. Please check your OAuth configuration.');
      } else {
        throw new Error(`Authentication failed: ${error.message}`);
      }
    }
  }

  
  static generateAuthUrl(client: OAuth2Client, options: {
    role: string;
    companyId?: string;
    companyName?: string;
    returnTo?: string;
  }) {
    try {
      
      const stateData = {
        role: options.role,
        companyId: options.companyId,
        companyName: options.companyName,
        returnTo: options.returnTo,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(2, 15)
      };
      
      const state = Buffer.from(JSON.stringify(stateData)).toString('base64');
      
      
      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent', 
        scope: [
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
        ],
        state,
        include_granted_scopes: true
      });
      
      return { url: authUrl, state };
    } catch (error) {
      throw new Error(`Failed to generate OAuth URL: ${error.message}`);
    }
  }

  
  static async verifyIdToken(client: OAuth2Client, idToken: string) {
    try {
      const ticket = await client.verifyIdToken({
        idToken, 
        audience: process.env.GOOGLE_CLIENT_ID?.trim()
      });
      
      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error('Failed to extract user information from token');
      }
      
      
      const { email, name, sub: googleId } = payload;
      if (!email || !name || !googleId) {
        const missing = [];
        if (!email) missing.push('email');
        if (!name) missing.push('name');
        if (!googleId) missing.push('id');
        
        throw new Error(`Google account missing required information: ${missing.join(', ')}`);
      }
      
      return payload;
    } catch (error) {
      console.error('Token verification error:', error.message);
      throw new Error('Could not verify your identity. Please try again.');
    }
  }

  
  static async refreshTokens(client: OAuth2Client, refreshToken: string) {
    try {
      client.setCredentials({
        refresh_token: refreshToken
      });
      
      const { credentials } = await client.refreshAccessToken();
      console.log('Successfully refreshed access token');
      return credentials;
    } catch (error) {
      console.error('Token refresh error:', error.message);
      throw new Error('Failed to refresh authentication. Please sign in again.');
    }
  }

  
  static async revokeToken(client: OAuth2Client, token: string) {
    try {
      await client.revokeToken(token);
      console.log('Successfully revoked OAuth token');
    } catch (error) {
      console.error('Token revocation error:', error.message);
      throw new Error('Failed to revoke authentication token.');
    }
  }

  
  static async revokeTokens(client: OAuth2Client, token: string) {
    return this.revokeToken(client, token);
  }
}
