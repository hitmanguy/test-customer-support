import { Schema, model } from 'mongoose';

const ticketSchema = new Schema({
  title: {type: String, required: true},
  content: {type: String, required: true},
  status: {type: String, enum: ['open', 'in_progress', 'closed'], default: 'open'},
  attachment: {type: String, default: null},
  sender_role: {type: String, enum: ['customer', 'bot'], required: true},
  solution: {type: String, default: null},
  solution_attachment: {type: String, default: null},
  customerId: {type: Schema.Types.ObjectId, ref: 'Customer', required: true},
  agentId: {type: Schema.Types.ObjectId, ref: 'Agent', required: true},
  companyId: {type: Schema.Types.ObjectId, ref: 'Company', required: true},
  chatId: {type: Schema.Types.ObjectId, ref: 'Chat', required: true},
}, { timestamps: true });

ticketSchema.index({ companyId: 1, status: 1, createdAt: -1 });
ticketSchema.index({ agentId: 1, status: 1, createdAt: -1 });
ticketSchema.index({ customerId: 1, status: 1, createdAt: -1 });
ticketSchema.index({ chatId: 1 });

export const Ticket = model('Ticket', ticketSchema);