import { Schema, model } from "mongoose";

const knowledgeBaseSchema = new Schema({
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    fileType: { type: String, enum: ['pdf', 'txt', 'md'], required: true },
    fileSize: { type: Number, required: true },
    cloudinaryUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },
    category: { type: String, default: 'General Knowledge' },
    description: { type: String },
    vectorIds: [{ type: String }], // Pinecone vector IDs
    chunksCount: { type: Number, default: 0 },
    processingStatus: { 
        type: String, 
        enum: ['pending', 'processing', 'completed', 'failed'], 
        default: 'pending' 
    },
    processingError: { type: String },
    lastProcessedAt: { type: Date },
}, { timestamps: true });

knowledgeBaseSchema.index({ companyId: 1 });
knowledgeBaseSchema.index({ processingStatus: 1 });
knowledgeBaseSchema.index({ fileType: 1 });
knowledgeBaseSchema.index({ filename: 'text', originalName: 'text', description: 'text' });

export const KnowledgeBase = model('KnowledgeBase', knowledgeBaseSchema);