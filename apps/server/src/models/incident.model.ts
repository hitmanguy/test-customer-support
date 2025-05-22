import { Schema, model, models } from 'mongoose';

const incidentSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  tickets: [{ type: Schema.Types.ObjectId, ref: 'Ticket' }],
  status: { type: String, enum: ['open', 'investigating', 'resolved'], default: 'open' },
}, { timestamps: true });

export const Incident = models.Incident || model('Incident', incidentSchema);