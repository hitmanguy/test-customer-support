import { Schema,model  } from "mongoose";

const customerSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },  
    verified: { type: Boolean, default: false },
    googleId: { type: String },  
    picture: { type: String },
    authType: { type: String, enum: ['local', 'google'], required: true },
    verificationOTP: { type: String },
    otpExpiry: { type: Date },
}, { timestamps: true });

export const Customer = model('Customer', customerSchema);