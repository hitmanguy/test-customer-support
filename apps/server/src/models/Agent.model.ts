import { Schema,model } from "mongoose";

const agentSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, 
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    verified: { type: Boolean, default: false },    googleId: { type: String },  
    picture: { type: String },
    refreshToken: { type: String },
    authType: { type: String, enum: ['local', 'google'], required: true },
    verificationOTP: { type: String },
    otpExpiry: { type: Date },
    lastOTPSent: { type: Date },
    lastLogin: { type: Date },
}, { timestamps: true });

export const Agent = model('Agent', agentSchema);
