import { Schema, model} from 'mongoose';

const a_chatSchema = new Schema({
  agentId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  contents: [
    {
      role: { type: String, enum: ['agent', 'bot'], required: true },
      content: { type: String, required: true },
      attachment: { type: String, default: null },
      createdAt: { type: Date, default: Date.now }
    }
  ],
}, { timestamps: true });

a_chatSchema.index({ agentId: 1, updatedAt: -1 });
a_chatSchema.index({ 'contents.content': 'text' });
a_chatSchema.index({ 'contents.createdAt': 1 });

export const A_Chat = model('A_Chat', a_chatSchema);