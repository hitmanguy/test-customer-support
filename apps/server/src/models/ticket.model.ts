import { Schema, model, models } from 'mongoose';

const ticketSchema = new Schema({
  subject: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['open', 'pending', 'closed'], default: 'open' },
  customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  agentId: { type: Schema.Types.ObjectId, ref: 'User' },
  comments: [{ type: Schema.Types.ObjectId, ref: 'Comment' }],
  incidentId: { type: Schema.Types.ObjectId, ref: 'Incident' },
}, { timestamps: true });

export const Ticket = models.Ticket || model('Ticket', ticketSchema);