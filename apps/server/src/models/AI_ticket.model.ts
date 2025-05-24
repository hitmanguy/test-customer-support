import { Schema,model } from "mongoose";

const ai_ticketSchema = new Schema({
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    priority_rate: { type: Number, required: true },
    predicted_solution: { type: String, required: true },
    predicted_solution_attachment: { type: String, default: null },
    summarized_content: { type: String, required: true },
    similar_ticketids: [{ type: Schema.Types.ObjectId, ref: 'Ticket' }],
}, { timestamps: true });


ai_ticketSchema.index({ ticketId: 1 }, { unique: true });
ai_ticketSchema.index({ companyId: 1, priority_rate: -1 });
ai_ticketSchema.index({ similar_ticketids: 1 });

export const AITicket = model('AITicket', ai_ticketSchema);

