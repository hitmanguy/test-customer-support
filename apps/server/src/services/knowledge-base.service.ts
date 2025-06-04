import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Pinecone } from '@pinecone-database/pinecone';
import { KnowledgeBase } from '../models/kb.model';
import * as MarkdownIt from 'markdown-it';
import { v4 as uuidv4 } from 'uuid';

// Use require for pdf-parse to avoid type issues
const pdfParse = require('pdf-parse');

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);
  private pinecone: Pinecone;
  private md: MarkdownIt;
  constructor(private readonly configService: ConfigService) {
    // Initialize Cloudinary
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    
    this.logger.log(`Cloudinary Config - Cloud Name: ${cloudName}, API Key: ${apiKey ? 'SET' : 'NOT SET'}, API Secret: ${apiSecret ? 'SET' : 'NOT SET'}`);
    
    if (!cloudName || !apiKey || !apiSecret) {
      this.logger.error('Missing Cloudinary credentials in environment variables');
      throw new Error('Cloudinary credentials not properly configured');
    }
    
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });// Initialize Pinecone
    this.pinecone = new Pinecone({
      apiKey: this.configService.get<string>('PINECONE_API_KEY') || '',
    });

    // Initialize Markdown parser
    this.md = new MarkdownIt();
  }

  /**
   * Process and upload knowledge base file
   */  async processKnowledgeBase(
    file: Express.Multer.File,
    companyId: string,
    category: string = 'General Knowledge'
  ): Promise<{
    success: boolean;
    message: string;
    fileUrl?: string;
    chunksProcessed?: number;
    vectorIds?: string[];
  }> {
    try {
      this.logger.log(`Processing knowledge base file for company: ${companyId}`);

      // Skip Cloudinary upload for now due to invalid credentials
      let uploadResult = { secure_url: `local://${file.originalname}` };
      
      try {
        // Try to upload to Cloudinary, but don't fail if it doesn't work
        uploadResult = await this.uploadToCloudinary(file, companyId);
        this.logger.log('Successfully uploaded to Cloudinary');
      } catch (cloudinaryError) {
        this.logger.warn('Cloudinary upload failed, proceeding without file storage:', cloudinaryError.message);
        // Continue with local processing
      }
      
      // Extract text from file
      const text = await this.extractTextFromFile(file);
      
      // Create meaningful chunks
      const chunks = this.createMeaningfulChunks(text, file.originalname);
      
      // Upload chunks to Pinecone
      const vectorIds = await this.uploadToPinecone(chunks, companyId, category, file.originalname);

      this.logger.log(`Successfully processed ${chunks.length} chunks for company: ${companyId}`);

      return {
        success: true,
        message: `Successfully processed ${chunks.length} knowledge chunks`,
        fileUrl: uploadResult.secure_url,
        chunksProcessed: chunks.length,
        vectorIds
      };
    } catch (error) {
      this.logger.error('Error processing knowledge base:', error);
      throw new BadRequestException(`Failed to process knowledge base: ${error.message}`);
    }
  }
  /**
   * Upload file to Cloudinary
   */
  private async uploadToCloudinary(file: Express.Multer.File, companyId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `knowledge-base/${companyId}`,
          public_id: `${Date.now()}-${file.originalname}`,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) {
            this.logger.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );      // Convert file.buffer to proper Buffer if it's not already
      const fileBuffer = file.buffer as any;
      let buffer: Buffer;
      
      if (Buffer.isBuffer(fileBuffer)) {
        buffer = fileBuffer;
      } else if (fileBuffer instanceof Uint8Array) {
        buffer = Buffer.from(fileBuffer);
      } else if (Array.isArray(fileBuffer)) {
        buffer = Buffer.from(fileBuffer);
      } else if (typeof fileBuffer === 'object' && fileBuffer !== null && 'data' in fileBuffer) {
        // Handle case where buffer comes as {type: 'Buffer', data: [array]}
        buffer = Buffer.from(fileBuffer.data);
      } else {
        // Fallback: try to create buffer from whatever we have
        buffer = Buffer.from(fileBuffer);
      }

      uploadStream.end(buffer);
    });
  }
  /**
   * Extract text from different file types
   */
  private async extractTextFromFile(file: Express.Multer.File): Promise<string> {
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

    // Convert file.buffer to proper Buffer if it's not already
    const fileBuffer = file.buffer as any;
    let buffer: Buffer;
    
    if (Buffer.isBuffer(fileBuffer)) {
      buffer = fileBuffer;
    } else if (fileBuffer instanceof Uint8Array) {
      buffer = Buffer.from(fileBuffer);
    } else if (Array.isArray(fileBuffer)) {
      buffer = Buffer.from(fileBuffer);
    } else if (typeof fileBuffer === 'object' && fileBuffer !== null && 'data' in fileBuffer) {
      buffer = Buffer.from(fileBuffer.data);
    } else {
      buffer = Buffer.from(fileBuffer);
    }

    switch (fileExtension) {
      case 'pdf':
        return await this.extractFromPDF(buffer);
      case 'txt':
        return buffer.toString('utf-8');
      case 'md':
      case 'markdown':
        return this.extractFromMarkdown(buffer.toString('utf-8'));
      default:
        throw new BadRequestException(`Unsupported file type: ${fileExtension}`);
    }
  }

  /**
   * Extract text from PDF
   */
  private async extractFromPDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      this.logger.error('PDF parsing error:', error);
      throw new BadRequestException('Failed to parse PDF file');
    }
  }

  /**
   * Extract text from Markdown
   */
  private extractFromMarkdown(markdown: string): Promise<string> {
    // Convert markdown to HTML, then strip HTML tags for clean text
    const html = this.md.render(markdown);
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return Promise.resolve(text);
  }

  /**
   * Create meaningful chunks with optimized algorithm
   */
  private createMeaningfulChunks(
    text: string, 
    sourceDocument: string, 
    chunkSize: number = 1000, 
    overlap: number = 200
  ): Array<{ id: string; text: string; title: string }> {
    const chunks: Array<{ id: string; text: string; title: string }> = [];
    
    // Clean and normalize text
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    // Split by natural boundaries (paragraphs, sections)
    const sections = this.splitIntoSections(cleanText);
    
    for (const section of sections) {
      if (section.length <= chunkSize) {
        // Section is small enough, use as single chunk
        chunks.push({
          id: uuidv4(),
          text: section,
          title: this.generateChunkTitle(section, sourceDocument)
        });
      } else {
        // Split large section into smaller chunks with overlap
        const sectionChunks = this.splitWithOverlap(section, chunkSize, overlap);
        sectionChunks.forEach(chunk => {
          chunks.push({
            id: uuidv4(),
            text: chunk,
            title: this.generateChunkTitle(chunk, sourceDocument)
          });
        });
      }
    }

    return chunks;
  }

  /**
   * Split text into logical sections
   */
  private splitIntoSections(text: string): string[] {
    // Split by double newlines (paragraphs) or section markers
    const sections = text.split(/\n\s*\n|\.\s+(?=[A-Z])|;\s+(?=[A-Z])/)
      .map(section => section.trim())
      .filter(section => section.length > 50); // Filter out very short sections

    return sections.length > 0 ? sections : [text];
  }

  /**
   * Split text with overlap for better context preservation
   */
  private splitWithOverlap(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + chunkSize;
      
      // Try to end at a sentence boundary
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastExclamation = text.lastIndexOf('!', end);
        const lastQuestion = text.lastIndexOf('?', end);
        
        const sentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
        if (sentenceEnd > start + chunkSize * 0.7) {
          end = sentenceEnd + 1;
        }
      }

      chunks.push(text.slice(start, end).trim());
      start = end - overlap;
    }

    return chunks;
  }

  /**
   * Generate meaningful chunk title
   */
  private generateChunkTitle(text: string, sourceDocument: string): string {
    const firstSentence = text.split(/[.!?]/)[0]?.trim();
    if (firstSentence && firstSentence.length < 100) {
      return firstSentence;
    }
    
    // Extract first few words as title
    const words = text.split(' ').slice(0, 10).join(' ');
    return `${words}... (from ${sourceDocument})`;
  }

  /**
   * Upload chunks to Pinecone
   */
  private async uploadToPinecone(
    chunks: Array<{ id: string; text: string; title: string }>,
    companyId: string,
    category: string,
    sourceDocument: string
  ): Promise<string[]> {
    try {
      const indexName = this.configService.get<string>('PINECONE_INDEX_NAME') || 'knowledge-base';
      const index = this.pinecone.index(indexName);

      // Create vectors for each chunk
      const vectors = await Promise.all(
        chunks.map(async (chunk) => {
          // For now, we'll use a simple embedding (you can integrate with OpenAI/other embedding models)
          const embedding = await this.createEmbedding(chunk.text);
          
          return {
            id: chunk.id,
            values: embedding,
            metadata: {
              category,
              company_id: companyId,
              source_document: sourceDocument,
              text: chunk.text,
              title: chunk.title,
              created_at: new Date().toISOString()
            }
          };
        })
      );

      // Upload to Pinecone in batches
      const batchSize = 100;
      const vectorIds: string[] = [];

      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await index.upsert(batch);
        vectorIds.push(...batch.map(v => v.id));
        
        this.logger.log(`Uploaded batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(vectors.length/batchSize)}`);
      }

      return vectorIds;
    } catch (error) {
      this.logger.error('Error uploading to Pinecone:', error);
      throw new BadRequestException(`Failed to upload to vector database: ${error.message}`);
    }
  }
  /**
   * Create simple embedding (can be replaced with OpenAI/other models)
   */
  private async createEmbedding(text: string): Promise<number[]> {
    // Simple hash-based embedding for demonstration
    // In production, use OpenAI embeddings or similar
    const hash = this.simpleHash(text);
    const embedding = new Array(1024).fill(0);
    
    for (let i = 0; i < text.length && i < 1024; i++) {
      embedding[i] = (text.charCodeAt(i) / 127.0) * Math.sin(hash + i);
    }
    
    return embedding;
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Search knowledge base
   */
  async searchKnowledgeBase(
    query: string,
    companyId: string,
    topK: number = 5
  ): Promise<any[]> {
    try {
      const indexName = this.configService.get<string>('PINECONE_INDEX_NAME') || 'knowledge-base';
      const index = this.pinecone.index(indexName);

      const queryEmbedding = await this.createEmbedding(query);

      const searchResults = await index.query({
        vector: queryEmbedding,
        topK,
        filter: { company_id: companyId },
        includeMetadata: true
      });

      return searchResults.matches?.map(match => ({
        id: match.id,
        score: match.score,
        text: match.metadata?.text,
        title: match.metadata?.title,
        source: match.metadata?.source_document,
        category: match.metadata?.category
      })) || [];
    } catch (error) {
      this.logger.error('Error searching knowledge base:', error);
      return [];
    }
  }

  /**
   * Delete knowledge base entries
   */
  async deleteKnowledgeBase(companyId: string, sourceDocument?: string): Promise<boolean> {
    try {
      const indexName = this.configService.get<string>('PINECONE_INDEX_NAME') || 'knowledge-base';
      const index = this.pinecone.index(indexName);

      const filter: any = { company_id: companyId };
      if (sourceDocument) {
        filter.source_document = sourceDocument;
      }

      await index.deleteMany(filter);
      this.logger.log(`Deleted knowledge base entries for company: ${companyId}`);
      
      return true;
    } catch (error) {
      this.logger.error('Error deleting knowledge base:', error);
      return false;
    }
  }

  /**
   * Get knowledge base stats
   */
  async getKnowledgeBaseStats(companyId: string): Promise<any> {
    try {
      const indexName = this.configService.get<string>('PINECONE_INDEX_NAME') || 'knowledge-base';
      const index = this.pinecone.index(indexName);

      // Query with empty vector to get stats
      const stats = await index.describeIndexStats();      return {
        totalVectors: stats.totalRecordCount || 0,
        indexDimension: stats.dimension || 1024,
        companyId
      };
    } catch (error) {
      this.logger.error('Error getting knowledge base stats:', error);
      return { totalVectors: 0, indexDimension: 1024, companyId };
    }
  }
}
