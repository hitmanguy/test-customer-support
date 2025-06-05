import { Injectable, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: nodemailer.Transporter;

  async onModuleInit() {
    
    await this.createTransporter();
  }

  private async createTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error('Email credentials not configured');
    }

    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, 
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD, 
      },
      tls: {
        rejectUnauthorized: false 
      }
    });

    
    try {
      await this.transporter.verify();
      console.log('Email service ready');
    } catch (error) {
      console.error('Email service configuration error:', error);
      throw error;
    }
  }

  async sendVerificationEmail(email: string, otp: string, name: string) {
    if (!this.transporter) {
      await this.createTransporter();
    }

    const mailOptions = {
      from: `"Customer Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify your Customer Support account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center;">Welcome to Customer Support!</h2>
            <p>Hello ${name},</p>
            <p>Please use the following verification code to complete your registration:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h1 style="color: #7C3AED; font-size: 32px; letter-spacing: 5px; text-align: center; margin: 0;">
                ${otp}
              </h1>
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          </div>
        </div>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Verification email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw new Error('Failed to send verification email: ' + error.message);
    }
  }
}