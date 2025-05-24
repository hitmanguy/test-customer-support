import { Schema,model } from "mongoose";

const kbSchema = new Schema({
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    knowledgeBases: [{
        title: { type: String, required: true },
        attachments: [{
            filename: { type: String, required: true },
            url: { type: String, required: true },
        }],
    }],
}, { timestamps: true });

kbSchema.index({ companyId: 1 });
kbSchema.index({ 'knowledgeBases.title': 'text' });

export const KB = model('KnowledgeBase', kbSchema);