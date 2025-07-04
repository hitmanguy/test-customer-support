import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TrpcService } from '../trpc/trpc.service';
import { Customer } from '../models/Customer.model';
import { Agent } from '../models/Agent.model';
import { Company } from '../models/Company.model';
import { KnowledgeBase } from '../models/kb.model';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { EmailService } from '../services/email.service';
import { GoogleOAuthHelper } from '../utils/google-oauth-helper';

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

interface JWTPayload {
  id: string;
  email: string;
  role: 'customer' | 'agent' | 'company';
  requiresKnowledgeBase?: boolean;
}

const googleOAuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
};

@Injectable()
export class AuthRouter {
  private googleClient: OAuth2Client;
  
  constructor(private readonly trpc: TrpcService, private readonly emailService: EmailService) {
    this.googleClient = GoogleOAuthHelper.createClient();
  }

  private async generateToken(payload: JWTPayload): Promise<string> {
    return jwt.sign(
      payload,
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '720h' }
    );
  }

  private async validatePassword(password: string): Promise<string> {
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }
    return bcrypt.hash(password, 10);
  }

  authRouter = this.trpc.router({
    registerCustomer: this.trpc.procedure
      .input(this.trpc.z.object({
        name: this.trpc.z.string().min(2),
        email: this.trpc.z.string().email(),
        password: this.trpc.z.string().min(6),
      }))
      .mutation(async ({ input }) => {
        try {
          const existing = await Customer.findOne({ email: input.email });
          if (existing && existing.verified) throw new Error("Email already registered");

          const hashedPassword = await this.validatePassword(input.password);
          const otp = generateOTP();
          const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); 

          
          await this.emailService.sendVerificationEmail(
            input.email,
            otp,
            input.name
          );
          let customer;
          if(existing){
            customer = await Customer.findByIdAndDelete(existing._id);
          }          customer = await Customer.create({
            name: input.name.trim(),
            email: input.email.toLowerCase(),
            password: hashedPassword,
            authType: 'local' as const,
            verified: false,
            verificationOTP: otp,
            otpExpiry,
            lastOTPSent: new Date()
          });

          const token = await this.generateToken({
            id: customer._id.toString(),
            email: customer.email,
            role: 'customer'
          });

          return { 
            success: true, 
            token,
            user: {
              id: customer._id,
              name: customer.name,
              email: customer.email,
              role: 'customer',
              verified: false
            },
            message: "Verification code sent to your email"
          };
        } catch (error) {
          throw new Error(error.message || "Registration failed");
        }
      }),
  googleAuth: this.trpc.procedure
  .input(this.trpc.z.object({
    role: this.trpc.z.enum(['customer', 'agent', 'company']),
    companyId: this.trpc.z.string().optional(),
    companyName: this.trpc.z.string().optional(),
    returnTo: this.trpc.z.string().optional(),
  }))
  .query(({ input }) => {
    try {
      
      const stateData = {
        role: input.role,
        companyId: input.companyId,
        companyName: input.companyName,
        returnTo: input.returnTo,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(2, 15)
      };
      
      const state = Buffer.from(JSON.stringify(stateData)).toString('base64');

      const authUrl = this.googleClient.generateAuthUrl({
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
  }),

googleCallback: this.trpc.procedure
  .input(this.trpc.z.object({
    code: this.trpc.z.string(),
    state: this.trpc.z.string().optional(),
    role: this.trpc.z.enum(['customer', 'agent', 'company']).optional(),
    companyId: this.trpc.z.string().optional(),
    companyName: this.trpc.z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    try {
      
      let stateData: any = {};
      if (input.state) {
        try {
          const decodedState = Buffer.from(input.state, 'base64').toString('utf-8');
          stateData = JSON.parse(decodedState);
          
          
          if (stateData.timestamp && Date.now() - stateData.timestamp > 10 * 60 * 1000) {
            throw new Error('Authentication session expired. Please try again.');
          }
        } catch (error) {
          throw new Error('Invalid authentication state. Please try again.');
        }
      }
      
      
      const role = stateData.role || input.role;
      const companyId = stateData.companyId || input.companyId;
      const companyName = stateData.companyName || input.companyName;
      
      if (!role) {
        throw new Error('Role information missing. Please try again.');
      }
      
      
      const tokens = await GoogleOAuthHelper.exchangeCodeForTokens(this.googleClient, input.code);
      
      
      const userInfo = await GoogleOAuthHelper.verifyIdToken(this.googleClient, tokens.id_token!);
      
      const { email, name, picture, sub: googleId } = userInfo;
      
      
      let user = await this.findUserByEmail(email!.toLowerCase(), role);
      
      if (user) {
        
        if (user.authType !== 'google') {
          throw new Error("Email already registered with password. Please login with password.");
        }
      } else {
        
        const userData = {
          name: name!,
          email: email!.toLowerCase(),
          googleId,
          picture,
          verified: true,
          authType: 'google' as const
        };
        
        switch (role) {
          case 'customer':
            user = await Customer.create(userData);
            break;
            
          case 'agent':
            if (!companyId) throw new Error("Company ID required for agent");
            const company = await Company.findById(companyId);
            if (!company) throw new Error("Company not found");
            
            user = await Agent.create({
              ...userData,
              companyId
            });
            break;
            
          case 'company':
            if (!companyName) throw new Error("Company name required");
            user = await Company.create({
              ...userData,
              name: companyName,
              o_name: name!,
              email: email!.toLowerCase(),
              support_emails: []
            });
            break;
        }      }
      
      
      if (!user) {
        throw new Error("Failed to create or find user");
      }
      
      
      const token = await this.generateToken({
        id: user._id.toString(),
        email: user.email,
        role
      });
      
      
      return {
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role,
          picture: user.picture,
          verified: true,
          companyId: 'companyId' in user ? user.companyId : undefined,
          authType: 'google'
        },
        returnTo: stateData.returnTo
      };
    } catch (error) {
      console.error('Google OAuth error:', error.message);
      throw new Error(error.message || "Google authentication failed");
    }
  }),
    verifyOTP: this.trpc.procedure
      .input(this.trpc.z.object({
        email: this.trpc.z.string().email(),
        otp: this.trpc.z.string().length(6),
        role: this.trpc.z.enum(['customer', 'agent', 'company']),
      }))
      .mutation(async ({ input }) => {
        try {
          const { user } = await this.findUserByRole(input);
          if (!user) throw new Error("User not found");

          if (user.verified) throw new Error("Email already verified");
          if (!user.verificationOTP) throw new Error("No verification code requested");
          if (!user.otpExpiry || Date.now() > user.otpExpiry.getTime()) throw new Error("Verification code expired");
          if (user.verificationOTP !== input.otp) throw new Error("Invalid verification code");          
          await this.verifyUser(user._id.toString(), input.role);          
          if (input.role === 'company') {
            const updatedCompany = await Company.findById(user._id);
            
            if (!updatedCompany) {
              throw new Error("Company not found");
            }
            
            const newToken = await this.generateToken({
              id: updatedCompany._id.toString(),
              email: updatedCompany.email,
              role: 'company',
              requiresKnowledgeBase: updatedCompany.requiresKnowledgeBase
            });

            return { 
              success: true,
              message: "Email verified successfully",
              token: newToken,
              user: {
                id: updatedCompany._id,
                name: updatedCompany.name,
                email: updatedCompany.email,
                role: 'company',
                verified: true,
                requiresKnowledgeBase: updatedCompany.requiresKnowledgeBase
              }
            };
          }

          return { 
            success: true,
            message: "Email verified successfully"
          };
        } catch (error) {
          throw new Error(error.message || "Verification failed");
        }
      }),

    

resendOTP: this.trpc.procedure
  .input(this.trpc.z.object({
    email: this.trpc.z.string().email(),
    role: this.trpc.z.enum(['customer', 'agent', 'company']),
  }))
  .mutation(async ({ input }) => {
    try {
      const { user } = await this.findUserByRole(input);
      if (!user) throw new Error("User not found");

      
      if (user.verified) {
        throw new Error("Email already verified");
      }      
      const now = new Date();
      const thirtySecondsAgo = new Date(now.getTime() - 30000);
      
      if (user.lastOTPSent && user.lastOTPSent > thirtySecondsAgo) {
        const remainingTime = Math.ceil((user.lastOTPSent.getTime() + 30000 - now.getTime()) / 1000);
        throw new Error(`Please wait ${remainingTime} seconds before requesting a new code`);
      }      
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); 
      const lastOTPSent = new Date();

      
      switch (input.role) {
        case 'customer':
          await Customer.findByIdAndUpdate(user._id, {
            verificationOTP: otp,
            otpExpiry,
            lastOTPSent
          });
          break;
        case 'agent':
          await Agent.findByIdAndUpdate(user._id, {
            verificationOTP: otp,
            otpExpiry,
            lastOTPSent
          });
          break;
        case 'company':
          await Company.findByIdAndUpdate(user._id, {
            verificationOTP: otp,
            otpExpiry,
            lastOTPSent
          });
          break;
      }

      
      await this.emailService.sendVerificationEmail(
        input.role === 'company' ? user.email : user.email,
        otp,
        input.role === 'company' ? user.name : user.name
      );

      return {
        success: true,
        message: "New verification code sent to your email"
      };
    } catch (error) {
      throw new Error(error.message || "Failed to resend verification code");
    }
  }),
          

    registerAgent: this.trpc.procedure
      .input(this.trpc.z.object({
        name: this.trpc.z.string().min(2),
        email: this.trpc.z.string().email(),
        password: this.trpc.z.string().min(6),
        companyId: this.trpc.z.string(),
      }))
      .mutation(async ({ input }) => {        try {
          const existing = await Agent.findOne({ email: input.email });
          if (existing && existing.verified) throw new Error("Email already registered");

          const company = await Company.findById(input.companyId);
          if (!company) throw new Error("Company not found");

          const hashedPassword = await this.validatePassword(input.password);
          const otp = generateOTP();
          const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

          await this.emailService.sendVerificationEmail(
            input.email.toLowerCase(),
            otp,
            input.name
          );

          let agent;
          if (existing) {
            agent = await Agent.findByIdAndDelete(existing._id);
          }

          agent = await Agent.create({
            name: input.name.trim(),
            email: input.email.toLowerCase(),
            password: hashedPassword,
            companyId: input.companyId,
            authType: 'local' as const,
            verified: false,
            verificationOTP: otp,
            otpExpiry,
            lastOTPSent: new Date()
          });


          const token = await this.generateToken({
            id: agent._id.toString(),
            email: agent.email,
            role: 'agent'
          });

          return { 
            success: true, 
            token,
            user: {
              id: agent._id,
              name: agent.name,
              email: agent.email,
              role: 'agent',
              verified: false,
              companyId: agent.companyId
            },
            message: "Verification code sent to your email"
          };
        } catch (error) {
          throw new Error(error.message || "Registration failed");
        }
      }),

    registerCompany: this.trpc.procedure
      .input(this.trpc.z.object({
        name: this.trpc.z.string().min(2),
        o_name: this.trpc.z.string().min(2),
        o_email: this.trpc.z.string().email(),
        o_password: this.trpc.z.string().min(6),
        support_emails: this.trpc.z.array(this.trpc.z.string().email()),
      }))
      .mutation(async ({ input }) => {        try {
          const existing = await Company.findOne({ o_email: input.o_email });
          if (existing && existing.verified) throw new Error("Company email already registered");

          const hashedPassword = await this.validatePassword(input.o_password);
          const otp = generateOTP();
          const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

          await this.emailService.sendVerificationEmail(
            input.o_email.toLowerCase(),
            otp,
            input.o_name
          );

          let company;
          if (existing) {
            company = await Company.findByIdAndDelete(existing._id);
          }

          company = await Company.create({
            name: input.name.trim(),
            o_name: input.o_name.trim(),
            email: input.o_email.toLowerCase(),
            o_password: hashedPassword,
            support_emails: input.support_emails,
            authType: 'local' as const,
            verified: false,
            verificationOTP: otp,
            otpExpiry,
            lastOTPSent: new Date(),
            requiresKnowledgeBase: true
          });const token = await this.generateToken({
            id: company._id.toString(),
            email: company.email,
            role: 'company',
            requiresKnowledgeBase: true
          });

          return { 
            success: true, 
            token,
            user: {
              id: company._id,
              name: company.name,
              email: company.email,
              role: 'company',
              verified: false,
              requiresKnowledgeBase: true
            },
            message: "Verification code sent to your email"
          };
        } catch (error) {
          throw new Error(error.message || "Registration failed");
        }
      }),

        login: this.trpc.procedure
      .input(this.trpc.z.object({
        email: this.trpc.z.string().email(),
        password: this.trpc.z.string(),
        role: this.trpc.z.enum(['customer', 'agent', 'company']),
        companyId: this.trpc.z.string().optional()
      }))
      .mutation(async ({ input }) => {
        try {
          const { user, hashedPassword } = await this.findUserByRole(input);
          
          if (!user) {
            throw new UnauthorizedException("Invalid credentials");
          }

          
          if (user.authType === 'google') {
            throw new Error("Please login with Google");
          }

          
          if (!hashedPassword) {
            throw new UnauthorizedException("Invalid credentials");
          }

          const isValid = await bcrypt.compare(input.password, hashedPassword);
          if (!isValid) {
            throw new UnauthorizedException("Invalid credentials");
          }
          
          if (!user.verified) {
            throw new UnauthorizedException("Email not verified. Please verify your email first.");
          }
          if (input.role === 'agent') {
            
            if ('companyId' in user && input.companyId !== user.companyId?.toString()) {
              throw new Error("Invalid company ID");
            }
          }          const token = await this.generateToken({
            id: user._id.toString(),
            email: input.email,
            role: input.role,
            requiresKnowledgeBase: input.role === 'company' && 'requiresKnowledgeBase' in user ? user.requiresKnowledgeBase : undefined
          });return { 
            success: true, 
            token,
            user: {
              id: user._id,
              name: user.name,
              email: user.email,
              role: input.role,
              verified: user.verified,
              picture: user.picture,
              companyId: 'companyId' in user ? user.companyId : undefined,
              authType: user.authType,
              requiresKnowledgeBase: input.role === 'company' && 'requiresKnowledgeBase' in user ? user.requiresKnowledgeBase : undefined
            }
          };
        } catch (error) {
          throw new Error(error.message || "Login failed");
        }
      }),

    

verifySession: this.trpc.procedure
  .input(this.trpc.z.object({
    token: this.trpc.z.string(),
  }))
  .query(async ({ input }) => {
    try {
      const decoded = jwt.verify(
        input.token, 
        process.env.JWT_SECRET || 'your-secret-key'
      ) as JWTPayload;

      const user = await this.findUserById(decoded.id, decoded.role);
      if (!user) throw new Error("User not found");

       return { 
        success: true, 
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: decoded.role,
          verified: user.verified,
          picture: user.picture,
          companyId: 'companyId' in user ? user.companyId : undefined,
          authType: user.authType
        }
      };
    } catch (error) {
      return { success: false, user: null };
    }
  }),    logout: this.trpc.procedure
      .input(this.trpc.z.object({
        userId: this.trpc.z.string(),
        role: this.trpc.z.enum(['customer', 'agent', 'company']),
        token: this.trpc.z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          
          const user = await this.findUserById(input.userId, input.role);
          
          if (user && user.authType === 'google') {
            
            try {
              
              if ('refreshToken' in user && user.refreshToken) {
                await GoogleOAuthHelper.revokeToken(this.googleClient, user.refreshToken);
              }
              
              if (input.token) {
                await GoogleOAuthHelper.revokeToken(this.googleClient, input.token);
              }
            } catch (revokeError) {
              
              console.warn('Failed to revoke OAuth tokens during logout:', revokeError.message);
            }
          }
            
          if (user) {
            switch (input.role) {
              case 'customer':
                if ('refreshToken' in user) {
                  await Customer.findByIdAndUpdate(input.userId, { $unset: { refreshToken: 1 } });
                }
                break;
              case 'agent':
                if ('refreshToken' in user) {
                  await Agent.findByIdAndUpdate(input.userId, { $unset: { refreshToken: 1 } });
                }
                break;
              case 'company':
                if ('refreshToken' in user) {
                  await Company.findByIdAndUpdate(input.userId, { $unset: { refreshToken: 1 } });
                }
                break;
              default:
                throw new Error("Invalid role");
            }
          }
          
          return { 
            success: true, 
            message: "Successfully logged out" 
          };        } catch (error) {
          console.error('Logout error:', error.message);
          throw new Error("Logout failed");
        }
      }),

    refreshToken: this.trpc.procedure
      .input(this.trpc.z.object({
        userId: this.trpc.z.string(),
        role: this.trpc.z.enum(['customer', 'agent', 'company']),
      }))
      .mutation(async ({ input }) => {
        try {
          const user = await this.findUserById(input.userId, input.role);
          if (!user) throw new Error("User not found");
          
          if (user.authType !== 'google') {
            throw new Error("Token refresh only available for Google OAuth users");
          }
          
          if (!('refreshToken' in user) || !user.refreshToken) {
            throw new Error("No refresh token available. Please sign in again.");
          }
          
          
          const newTokens = await GoogleOAuthHelper.refreshTokens(this.googleClient, user.refreshToken);
          
          
          if (newTokens.refresh_token) {
            await this.updateUserRefreshToken(input.userId, input.role, newTokens.refresh_token);
          }
          
          
          const jwtToken = await this.generateToken({
            id: user._id.toString(),
            email: user.email,
            role: input.role
          });
          
          return {
            success: true,
            token: jwtToken,
            accessToken: newTokens.access_token
          };        } catch (error) {
          console.error('Token refresh error:', error.message);
          throw new Error(error.message || "Failed to refresh token");
        }
      }),

    refreshCompanyToken: this.trpc.procedure
      .input(this.trpc.z.object({
        companyId: this.trpc.z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const company = await Company.findById(input.companyId);
          if (!company) throw new Error("Company not found");
          
          
          const jwtToken = await this.generateToken({
            id: company._id.toString(),
            email: company.email,
            role: 'company',
            requiresKnowledgeBase: company.requiresKnowledgeBase || false
          });
          
          return {
            success: true,
            token: jwtToken,
            user: {
              id: company._id,
              name: company.name,
              email: company.email,
              role: 'company',
              verified: company.verified,
              picture: company.picture,
              authType: company.authType,
              requiresKnowledgeBase: company.requiresKnowledgeBase || false
            }
          };
        } catch (error) {
          console.error('Company token refresh error:', error.message);
          throw new Error(error.message || "Failed to refresh company token");
        }
      }),});

  
  private async updateUserRefreshToken(userId: string, role: string, refreshToken: string) {
    const update = { refreshToken };
    
    switch (role) {
      case 'customer':
        await Customer.findByIdAndUpdate(userId, update);
        break;
      case 'agent':
        await Agent.findByIdAndUpdate(userId, update);
        break;
      case 'company':
        await Company.findByIdAndUpdate(userId, update);
        break;
    }
  }

  
  private async findUserByRole(input: { email: string; role: string }) {
    let user;
    let hashedPassword;

    switch (input.role) {
      case 'customer':
        user = await Customer.findOne({ email: input.email });
        hashedPassword = user?.password;
        break;
      case 'agent':
        user = await Agent.findOne({ email: input.email });
        hashedPassword = user?.password;
        break;
      case 'company':
        user = await Company.findOne({ email: input.email });
        hashedPassword = user?.o_password;
        break;
      default:
        throw new Error("Invalid role");
    }

    return { user, hashedPassword };
  }    private async verifyUser(userId: string, role: string) {      const update = {
        verified: true,
        verificationOTP: null,
        otpExpiry: null,
        lastOTPSent: null,
      };

      switch (role) {
        case 'customer':
          await Customer.findByIdAndUpdate(userId, update);
          break;
        case 'agent':
          await Agent.findByIdAndUpdate(userId, update);
          break;        case 'company':
          
          const knowledgeBaseCount = await KnowledgeBase.countDocuments({ 
            companyId: userId,
            processingStatus: 'completed'
          });
            if (knowledgeBaseCount === 0) {
            
            await Company.findByIdAndUpdate(userId, {
              verified: true,
              verificationOTP: null,
              otpExpiry: null,
              lastOTPSent: null,
              requiresKnowledgeBase: true
            });
          } else {
            
            await Company.findByIdAndUpdate(userId, {
              verified: true,
              verificationOTP: null,
              otpExpiry: null,
              lastOTPSent: null,
              requiresKnowledgeBase: false
            });
          }
          break;
      }
    }

    
    private async checkCompanyKnowledgeBaseRequirement(companyId: string): Promise<boolean> {
      const knowledgeBaseCount = await KnowledgeBase.countDocuments({ 
        companyId,
        processingStatus: 'completed'
      });
      return knowledgeBaseCount > 0;
    }

  private async findUserById(id: string, role: string) {
    switch (role) {
      case 'customer':
        return Customer.findById(id);
      case 'agent':
        return Agent.findById(id);
      case 'company':
        return Company.findById(id);
      default:
        return null;
    }
  }

  private async findUserByEmail(email: string, role: string) {
      switch (role) {
        case 'customer':
          return Customer.findOne({ email });
        case 'agent':
          return Agent.findOne({ email });
        case 'company':
          return Company.findOne({ email: email });
        default:
          return null;
      }
    }
}

export const { authRouter } = new AuthRouter(new TrpcService(), new EmailService());