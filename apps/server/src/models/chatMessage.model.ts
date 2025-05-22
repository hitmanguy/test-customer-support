import { Schema, model, models } from 'mongoose';

const chatMessageSchema = new Schema({
  ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  senderRole: { type: String, enum: ['customer', 'agent', 'bot'], required: true },
}, { timestamps: true });

export const ChatMessage = models.ChatMessage || model('ChatMessage', chatMessageSchema);