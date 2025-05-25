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
          if (existing && existing.verified) throw new Error("Email already registered");

          const hashedPassword = await this.validatePassword(input.password);
          const otp = generateOTP();
          const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

          // Send verification email immediately after registration
          await this.emailService.sendVerificationEmail(
            input.email,
            otp,
            input.name
          );
          let customer;
          if(existing){
            customer = await Customer.findByIdAndDelete(existing._id);
          }
          customer = await Customer.create({
            name: input.name.trim(),
            email: input.email.toLowerCase(),
            password: hashedPassword,
            authType: 'local' as const,
            verified: false,
            verificationOTP: otp,
            otpExpiry
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
    const state = Buffer.from(JSON.stringify({
      role: input.role,
      companyId: input.companyId,
      companyName: input.companyName,
      returnTo: input.returnTo
    })).toString('base64');

    const authUrl = this.googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state
    });
    
    return { url: authUrl };
  }),

googleCallback: this.trpc.procedure
  .input(this.trpc.z.object({
    code: this.trpc.z.string(),
    role: this.trpc.z.enum(['customer', 'agent', 'company']),
    companyId: this.trpc.z.string().optional(),
    companyName: this.trpc.z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    try {
      // Get tokens from Google
      const { tokens } = await this.googleClient.getToken(input.code);
      this.googleClient.setCredentials(tokens);
      
      // Verify token
      const ticket = await this.googleClient.verifyIdToken({
        idToken: tokens.id_token!,
        audience: googleOAuthConfig.clientId
      });
      
      const payload = ticket.getPayload();
      if (!payload) throw new Error("Failed to get user info");
      
      const { email, name, picture, sub: googleId } = payload;
      if (!email || !name || !googleId) throw new Error("Incomplete user info");
      
      // Handle user creation/login based on role
      let user;
      
      // Check if user exists with this email
      switch (input.role) {
        case 'customer':
          user = await Customer.findOne({ email });
          break;
        case 'agent':
          user = await Agent.findOne({ email });
          break;
        case 'company':
          user = await Company.findOne({ email });
          break;
      }
      
      if (user) {
        // If user exists but wasn't created with Google, reject
        if (user.authType !== 'google') {
          throw new Error("Email already registered with password. Please login with password.");
        }
        
        // Return existing user info
      } else {
        // Create new user based on role
        const userData = {
          name,
          email: email.toLowerCase(),
          googleId,
          picture,
          verified: true,
          authType: 'google' as const
        };
        
        switch (input.role) {
          case 'customer':
            user = await Customer.create(userData);
            break;
          
          case 'agent':
            if (!input.companyId) throw new Error("Company ID required for agent");
            const company = await Company.findById(input.companyId);
            if (!company) throw new Error("Company not found");
            
            user = await Agent.create({
              ...userData,
              companyId: input.companyId
            });
            break;
            
          case 'company':
            if (!input.companyName) throw new Error("Company name required");
            user = await Company.create({
              ...userData,
              name: input.companyName,
              o_name: name,
              email: email.toLowerCase(),
              support_emails: []
            });
            break;
        }
      }
      
      // Generate JWT token
      const token = jwt.sign(
        {
          id: user._id.toString(),
          email: user.email,
          role: input.role
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '720h' }
      );
      
      // Return user info and token
      return {
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: input.role,
          picture: user.picture,
          verified: true,
          companyId: 'companyId' in user ? user.companyId : undefined
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

    // Add this to your authRouter object, alongside other procedures

resendOTP: this.trpc.procedure
  .input(this.trpc.z.object({
    email: this.trpc.z.string().email(),
    role: this.trpc.z.enum(['customer', 'agent', 'company']),
  }))
  .mutation(async ({ input }) => {
    try {
      const { user } = await this.findUserByRole(input);
      if (!user) throw new Error("User not found");

      // Check if user is already verified
      if (user.verified) {
        throw new Error("Email already verified");
      }

      // Check if previous OTP was sent within last 30 seconds
      if (user.otpExpiry && Date.now() - user.otpExpiry.getTime() > -30000) {
        throw new Error("Please wait 30 seconds before requesting a new code");
      }

      // Generate new OTP and expiry
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Update user with new OTP
      switch (input.role) {
        case 'customer':
          await Customer.findByIdAndUpdate(user._id, {
            verificationOTP: otp,
            otpExpiry
          });
          break;
        case 'agent':
          await Agent.findByIdAndUpdate(user._id, {
            verificationOTP: otp,
            otpExpiry
          });
          break;
        case 'company':
          await Company.findByIdAndUpdate(user._id, {
            verificationOTP: otp,
            otpExpiry
          });
          break;
      }

      // Send new verification email
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
      .mutation(async ({ input }) => {
        try {
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
          if (existing && existing.verified) throw new Error("Company email already registered");

          const hashedPassword = await this.validatePassword(input.o_password);
          const otp = generateOTP();
          const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);


          await this.emailService.sendVerificationEmail(
            input.o_email.toLowerCase(),
            otp,
            input.o_name
          );

          const company = await Company.create({
            name: input.name.trim(),
            o_name: input.o_name.trim(),
            email: input.o_email.toLowerCase(),
            o_password: hashedPassword,
            support_emails: input.support_emails,
            authType: 'local' as const,
            verified: false,
            verificationOTP: otp,
            otpExpiry
          });

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
        companyId: this.trpc.z.string().optional()
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
          // If user is not verified, throw error
          if (!user.verified) {
            throw new UnauthorizedException("Email not verified. Please verify your email first.");
          }
          if (input.role === 'agent') {
            // Only check companyId if user is an agent and has companyId property
            if ('companyId' in user && input.companyId !== user.companyId?.toString()) {
              throw new Error("Invalid company ID");
            }
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

    // MODIFY THE verifySession PROCEDURE ONLY:

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
        user = await Company.findOne({ email: input.email });
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
          return Company.findOne({ email: email });
        default:
          return null;
      }
    }
}

export const { authRouter } = new AuthRouter(new TrpcService(), new EmailService());