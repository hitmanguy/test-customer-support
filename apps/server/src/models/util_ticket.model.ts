import { Schema,model } from "mongoose";

const utilTicketSchema = new Schema({
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    seen_time: { type: Date, default: null },
    resolved_time: { type: Date, default: null },
    customer_review: { type: String, default: null },
    customer_review_rating: { type: Number, default: null }
}, { timestamps: true });


utilTicketSchema.index({ ticketId: 1 }, { unique: true });
utilTicketSchema.index({ companyId: 1, customer_review_rating: -1 });
utilTicketSchema.index({ resolved_time: 1 });

export const UtilTicket = model('UtilTicket', utilTicketSchema);