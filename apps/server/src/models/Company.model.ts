import { Schema,model } from "mongoose";

const companySchema = new Schema({
    name: { type: String, required: true },
    o_name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    o_password: { type: String, required: true },
    verified: { type: Boolean, default: false },
    support_emails: [{ type: String }],    picture: { type: String },
    refreshToken: { type: String },
    authType: { type: String, enum: ['local', 'google'], default: 'local', required: true },
    googleId: { type: String },
    verificationOTP: { type: String },
    otpExpiry: { type: Date },
    lastLogin: { type: Date },
}, { timestamps: true });

export const Company = model('Company', companySchema);