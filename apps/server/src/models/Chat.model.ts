import { Schema, model} from 'mongoose';

const chatSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  contents: [
    {
      role: { type: String, enum: ['customer', 'bot'], required: true },
      content: { type: String, required: true },
      attachment: { type: String, default: null },
      metadata: {
        sources: [{ type: String }],
        shouldCreateTicket: { type: Boolean },
        ticketId: { type: String },
        type: { type: String }
      },
      createdAt: { type: Date, default: Date.now }
    }
  ],
}, { timestamps: true });

chatSchema.index({ customerId: 1, updatedAt: -1 });
chatSchema.index({ 'contents.content': 'text' });
chatSchema.index({ 'contents.createdAt': 1 });

export const Chat = model('Chat', chatSchema);