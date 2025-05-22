import { Schema, model, models } from 'mongoose';

const userSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['customer', 'agent', 'admin'], required: true },
}, { timestamps: true });

export const User = models.User || model('User', userSchema);