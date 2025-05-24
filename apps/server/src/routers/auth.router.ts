import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TrpcService } from '../trpc/trpc.service';
import { Customer } from '../models/Customer.model';
import { Agent } from '../models/Agent.model';
import { Company } from '../models/Company.model';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { EmailService } from '../services/email.service';

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

interface JWTPayload {
  id: string;
  email: string;
  role: 'customer' | 'agent' | 'company';
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
    this.googleClient = new OAuth2Client(
      googleOAuthConfig.clientId,
      googleOAuthConfig.clientSecret,
      googleOAuthConfig.redirectUri
    );
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
          if (existing) throw new Error("Email already registered");

          const hashedPassword = await this.validatePassword(input.password);
          const otp = generateOTP();
          const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

          const customer = await Customer.create({
            name: input.name.trim(),
            email: input.email.toLowerCase(),
            password: hashedPassword,
            authType: 'local' as const,
            verified: false,
            verificationOTP: otp,
            otpExpiry
          });

          // Send verification email immediately after registration
          await this.emailService.sendVerificationEmail(
            customer.email,
            otp,
            customer.name
          );

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
        role: this.trpc.z.enum(['customer', 'agent']),
        companyId: this.trpc.z.string().optional(),
      }))
      .query(() => {
        const authUrl = this.googleClient.generateAuthUrl({
          access_type: 'offline',
          scope: [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
          ],
        });
        return { url: authUrl };
      }),

    googleCallback: this.trpc.procedure
      .input(this.trpc.z.object({
        code: this.trpc.z.string(),
        role: this.trpc.z.enum(['customer', 'agent']),
        companyId: this.trpc.z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          // Get tokens and user info from Google
          const { tokens } = await this.googleClient.getToken(input.code);
          this.googleClient.setCredentials(tokens);

          const ticket = await this.googleClient.verifyIdToken({
            idToken: tokens.id_token!,
            audience: googleOAuthConfig.clientId
          });

          const payload = ticket.getPayload();
          if (!payload) throw new Error("Failed to get user info");

          const { email, name, picture, sub: googleId } = payload;
          if (!email || !name || !googleId) throw new Error("Incomplete user info");

          // Check if user exists with this email
          const existingUser = await this.findUserByEmail(email, input.role);

          if (existingUser) {
            // If user exists but wasn't created with Google, reject
            if (existingUser.authType !== 'google') {
              throw new Error("Email already registered with password. Please login with password.");
            }

            // Login existing Google user
            const token = await this.generateToken({
              id: existingUser._id.toString(),
              email: existingUser.email,
              role: input.role
            });

            return {
              success: true,
              token,
              user: {
                id: existingUser._id,
                name: existingUser.name,
                email: existingUser.email,
                role: input.role,
                picture: existingUser.picture,
                verified: true,
                companyId: 'companyId' in existingUser ? existingUser.companyId : undefined
              }
            };
          }
          let newUser;

          if (input.role === 'agent' && !input.companyId) {
            throw new Error("Company ID required for agent registration");
          }

          const baseUserData = {
            name,
            email: email.toLowerCase(),
            googleId,
            picture,
            verified: true, // Google users are pre-verified
            authType: 'google' as const
          };

          switch (input.role) {
            case 'customer':
              newUser = await Customer.create(baseUserData);
              break;

            case 'agent':
              // Verify company exists
              const company = await Company.findById(input.companyId);
              if (!company) throw new Error("Company not found");
              
              newUser = await Agent.create({
                ...baseUserData,
                companyId: input.companyId,
              });
              break;

            default:
              throw new Error("Invalid role for Google authentication");
          }

          const token = await this.generateToken({
            id: newUser._id.toString(),
            email: newUser.email,
            role: input.role
          });

          return {
            success: true,
            token,
            user: {
              id: newUser._id,
              name: newUser.name,
              email: newUser.email,
              role: input.role,
              picture: newUser.picture,
              verified: true,
              companyId: 'companyId' in newUser ? newUser.companyId : undefined
            }
          };
        } catch (error) {
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

          // Verify user
          await this.verifyUser(user._id.toString(), input.role);

          return { 
            success: true,
            message: "Email verified successfully"
          };
        } catch (error) {
          throw new Error(error.message || "Verification failed");
        }
      }),
          

    registerAgent: this.trpc.procedure
      .input(this.trpc.z.object({
        name: this.trpc.z.string().min(2),
        email: this.trpc.z.string().email(),
        password: this.trpc.z.string().min(6),
        companyId: this.trpc.z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const existing = await Agent.findOne({ email: input.email });
          if (existing) throw new Error("Email already registered");

          const company = await Company.findById(input.companyId);
          if (!company) throw new Error("Company not found");

          const hashedPassword = await this.validatePassword(input.password);
          const otp = generateOTP();
          const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

          const agent = await Agent.create({
            name: input.name.trim(),
            email: input.email.toLowerCase(),
            password: hashedPassword,
            companyId: input.companyId,
            authType: 'local' as const,
            verified: false,
            verificationOTP: otp,
            otpExpiry
          });

          await this.emailService.sendVerificationEmail(
            agent.email,
            otp,
            agent.name
          );

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
      .mutation(async ({ input }) => {
        try {
          const existing = await Company.findOne({ o_email: input.o_email });
          if (existing) throw new Error("Company email already registered");

          const hashedPassword = await this.validatePassword(input.o_password);
          const otp = generateOTP();
          const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

          const company = await Company.create({
            name: input.name.trim(),
            o_name: input.o_name.trim(),
            o_email: input.o_email.toLowerCase(),
            o_password: hashedPassword,
            support_emails: input.support_emails,
            authType: 'local' as const,
            verified: false,
            verificationOTP: otp,
            otpExpiry
          });

          await this.emailService.sendVerificationEmail(
            company.email,
            otp,
            company.o_name
          );

          const token = await this.generateToken({
            id: company._id.toString(),
            email: company.email,
            role: 'company'
          });

          return { 
            success: true, 
            token,
            user: {
              id: company._id,
              name: company.name,
              email: company.email,
              role: 'company',
              verified: false
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
      }))
      .mutation(async ({ input }) => {
        try {
          const { user, hashedPassword } = await this.findUserByRole(input);
          
          if (!user) {
            throw new UnauthorizedException("Invalid credentials");
          }

          // If user was created with Google, reject password login
          if (user.authType === 'google') {
            throw new Error("Please login with Google");
          }

          // For password login, verify password exists
          if (!hashedPassword) {
            throw new UnauthorizedException("Invalid credentials");
          }

          const isValid = await bcrypt.compare(input.password, hashedPassword);
          if (!isValid) {
            throw new UnauthorizedException("Invalid credentials");
          }

          const token = await this.generateToken({
            id: user._id.toString(),
            email: input.email,
            role: input.role
          });

          return { 
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
              authType: user.authType
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

          // Find user to ensure they still exist and are active
          const user = await this.findUserById(decoded.id, decoded.role);
          if (!user) {
            throw new Error("User not found");
          }

          return { 
            success: true, 
            user: {
              id: decoded.id,
              email: decoded.email,
              role: decoded.role,
              name: user.name ,
              companyId: 'companyId' in user ? user.companyId : undefined
            }
          };
        } catch (error) {
          throw new Error("Invalid or expired token");
        }
      }),

    logout: this.trpc.procedure
      .input(this.trpc.z.object({
        userId: this.trpc.z.string(),
        role: this.trpc.z.enum(['customer', 'agent', 'company']),
      }))
      .mutation(async ({ input }) => {
        try {
          switch (input.role) {
            case 'customer':
              await Customer.findByIdAndDelete(input.userId);
              break;
            case 'agent':
              await Agent.findByIdAndDelete(input.userId);
              break;
            case 'company':
              await Company.findByIdAndDelete(input.userId);
              await Agent.deleteMany({ companyId: input.userId });
              break;
            default:
              throw new Error("Invalid role");
          }
          return { success: true };
        } catch (error) {
          throw new Error("Logout failed");
        }
      }),
  });

  // Helper methods
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
        user = await Company.findOne({ o_email: input.email });
        hashedPassword = user?.o_password;
        break;
      default:
        throw new Error("Invalid role");
    }

    return { user, hashedPassword };
  }

    private async verifyUser(userId: string, role: string) {
      const update = {
        verified: true,
        verificationOTP: null,
        otpExpiry: null,
      };

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
          return Company.findOne({ o_email: email });
        default:
          return null;
      }
    }
}

export const { authRouter } = new AuthRouter(new TrpcService(), new EmailService());