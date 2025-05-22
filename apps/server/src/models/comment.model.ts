import { Schema, model, models } from 'mongoose';

const commentSchema = new Schema({
  ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
  authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
}, { timestamps: true });

export const Comment = models.Comment || model('Comment', commentSchema);