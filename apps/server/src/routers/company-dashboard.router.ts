import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { TrpcService } from '../trpc/trpc.service';
import { KnowledgeBaseService } from '../services/knowledge-base.service';
import { CompanyAnalyticsService } from '../services/company-analytics.service';
import { Company } from '../models/Company.model';
import { KnowledgeBase } from '../models/kb.model';
import { z } from 'zod';
import * as multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown'];
    const allowedExtensions = ['.pdf', '.txt', '.md', '.markdown'];
    
    const isValidType = allowedTypes.includes(file.mimetype) || 
                       allowedExtensions.some(ext => file.originalname.toLowerCase().endsWith(ext));
      if (isValidType) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

@Injectable()
export class CompanyDashboardRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly analyticsService: CompanyAnalyticsService
  ) {}

  private getFileType(filename: string): 'pdf' | 'txt' | 'md' {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'pdf':
        return 'pdf';
      case 'md':
      case 'markdown':
        return 'md';
      case 'txt':
      default:
        return 'txt';
    }
  }

  companyDashboardRouter = this.trpc.router({
    // Knowledge Base Management
    uploadKnowledgeBase: this.trpc.procedure
      .input(z.object({
        companyId: z.string(),
        category: z.string().optional().default('General Knowledge'),
        fileData: z.object({
          originalname: z.string(),
          mimetype: z.string(),
          buffer: z.any(), // File buffer
          size: z.number()
        })
      }))
      .mutation(async ({ input }) => {
        const { companyId, category, fileData } = input;

        // Validate company exists
        const company = await Company.findById(companyId);
        if (!company) {
          throw new NotFoundException('Company not found');
        }

        // Process the knowledge base
        const result = await this.knowledgeBaseService.processKnowledgeBase(
          fileData as Express.Multer.File,
          companyId,
          category
        );        // Save knowledge base record in MongoDB
        const knowledgeBase = new KnowledgeBase({
          companyId,
          filename: fileData.originalname,
          originalName: fileData.originalname,
          fileType: this.getFileType(fileData.originalname),
          fileSize: fileData.size,
          cloudinaryUrl: result.fileUrl,
          cloudinaryPublicId: result.fileUrl, // This should be updated to actual public ID
          category,
          chunksCount: result.chunksProcessed,
          vectorIds: result.vectorIds,
          processingStatus: 'completed'
        });        await knowledgeBase.save();        // Check if this is the company's first knowledge base and activate them
        if (company.requiresKnowledgeBase) {
          await Company.findByIdAndUpdate(companyId, {
            requiresKnowledgeBase: false
          });
        }

        return {
          success: true,
          knowledgeBaseId: knowledgeBase._id,
          message: result.message,
          chunksProcessed: result.chunksProcessed,
          companyActivated: company.requiresKnowledgeBase,
          shouldRefreshToken: company.requiresKnowledgeBase // Signal frontend to refresh token
        };
      }),

    // Get company knowledge bases
    getKnowledgeBases: this.trpc.procedure
      .input(z.object({
        companyId: z.string(),
        limit: z.number().optional().default(20),
        offset: z.number().optional().default(0)
      }))
      .query(async ({ input }) => {
        const { companyId, limit, offset } = input;        const knowledgeBases = await KnowledgeBase.find({ companyId })
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(offset)
          .lean();

        const total = await KnowledgeBase.countDocuments({ companyId });

        return {
          knowledgeBases,
          total,
          hasMore: offset + limit < total
        };
      }),

    // Delete knowledge base
    deleteKnowledgeBase: this.trpc.procedure
      .input(z.object({
        companyId: z.string(),
        knowledgeBaseId: z.string()
      }))
      .mutation(async ({ input }) => {
        const { companyId, knowledgeBaseId } = input;

        const knowledgeBase = await KnowledgeBase.findOne({
          _id: knowledgeBaseId,
          companyId
        });

        if (!knowledgeBase) {
          throw new NotFoundException('Knowledge base not found');
        }        // Delete from Pinecone
        await this.knowledgeBaseService.deleteKnowledgeBase(
          companyId,
          knowledgeBase.filename
        );

        // Delete from MongoDB
        await KnowledgeBase.findByIdAndDelete(knowledgeBaseId);

        return {
          success: true,
          message: 'Knowledge base deleted successfully'
        };
      }),

    // Search knowledge base
    searchKnowledgeBase: this.trpc.procedure
      .input(z.object({
        companyId: z.string(),
        query: z.string(),
        topK: z.number().optional().default(5)
      }))
      .query(async ({ input }) => {
        const { companyId, query, topK } = input;

        const results = await this.knowledgeBaseService.searchKnowledgeBase(
          query,
          companyId,
          topK
        );

        return {
          results,
          query,
          total: results.length
        };
      }),

    // Company Analytics
    getCompanyAnalytics: this.trpc.procedure
      .input(z.object({
        companyId: z.string()
      }))
      .query(async ({ input }) => {
        const { companyId } = input;

        const analytics = await this.analyticsService.getCompanyAnalytics(companyId);
        return analytics;
      }),

    // Get company dashboard overview
    getDashboardOverview: this.trpc.procedure
      .input(z.object({
        companyId: z.string()
      }))
      .query(async ({ input }) => {
        const { companyId } = input;

        // Get basic company info
        const company = await Company.findById(companyId).lean();
        if (!company) {
          throw new NotFoundException('Company not found');
        }

        // Get analytics overview
        const analytics = await this.analyticsService.getCompanyAnalytics(companyId);

        // Get knowledge base stats
        const kbCount = await KnowledgeBase.countDocuments({ companyId });
        const kbStats = await this.knowledgeBaseService.getKnowledgeBaseStats(companyId);

        return {          company: {
            id: company._id,
            name: company.name,
            email: company.email,
            createdAt: company.createdAt
          },
          analytics: analytics.overview,
          knowledgeBase: {
            totalFiles: kbCount,
            totalVectors: kbStats.totalVectors
          },
          lastUpdated: new Date()
        };
      }),

    // Get trend analysis
    getTrendAnalysis: this.trpc.procedure
      .input(z.object({
        companyId: z.string(),
        timeRange: z.enum(['7d', '30d', '90d', '1y']).optional().default('30d')
      }))
      .query(async ({ input }) => {
        const { companyId } = input;

        const analytics = await this.analyticsService.getCompanyAnalytics(companyId);
        return {
          trends: analytics.trends,
          insights: analytics.insights,
          generatedAt: new Date()
        };
      }),

    // Get performance metrics
    getPerformanceMetrics: this.trpc.procedure
      .input(z.object({
        companyId: z.string()
      }))
      .query(async ({ input }) => {
        const { companyId } = input;

        const analytics = await this.analyticsService.getCompanyAnalytics(companyId);
        return {
          performance: analytics.performance,
          generatedAt: new Date()
        };
      }),

    // Update company settings
    updateCompanySettings: this.trpc.procedure
      .input(z.object({
        companyId: z.string(),
        settings: z.object({
          name: z.string().optional(),
          industry: z.string().optional(),
          timezone: z.string().optional(),
          workingHours: z.object({
            start: z.string(),
            end: z.string(),
            timezone: z.string()
          }).optional(),
          aiSettings: z.object({
            autoResponseEnabled: z.boolean(),
            suggestionThreshold: z.number().min(0).max(1),
            escalationRules: z.array(z.object({
              condition: z.string(),
              action: z.string()
            }))
          }).optional()
        })
      }))
      .mutation(async ({ input }) => {
        const { companyId, settings } = input;

        const company = await Company.findByIdAndUpdate(
          companyId,
          { $set: settings },
          { new: true }
        ).lean();

        if (!company) {
          throw new NotFoundException('Company not found');
        }

        return {
          success: true,
          company,
          message: 'Company settings updated successfully'
        };
      }),    // Check knowledge base requirement for signup
    checkKnowledgeBaseRequirement: this.trpc.procedure
      .input(z.object({
        companyId: z.string()
      }))
      .query(async ({ input }) => {
        const { companyId } = input;

        const company = await Company.findById(companyId).lean();
        if (!company) {
          throw new NotFoundException('Company not found');
        }

        const kbCount = await KnowledgeBase.countDocuments({ 
          companyId,
          processingStatus: 'completed'
        });

        return {
          requiresKnowledgeBase: company.requiresKnowledgeBase || false,
          hasRequiredKnowledgeBase: kbCount > 0,
          knowledgeBaseCount: kbCount,
          minimumRequired: 1,
          companyVerified: company.verified
        };
      }),

    // Activate company after knowledge base upload
    activateCompanyAfterKnowledgeBase: this.trpc.procedure
      .input(z.object({
        companyId: z.string()
      }))
      .mutation(async ({ input }) => {
        const { companyId } = input;

        const kbCount = await KnowledgeBase.countDocuments({ 
          companyId,
          processingStatus: 'completed'
        });

        if (kbCount === 0) {
          throw new BadRequestException('Company must have at least one knowledge base file');
        }

        await Company.findByIdAndUpdate(companyId, {
          requiresKnowledgeBase: false
        });

        return {
          success: true,
          message: 'Company activated successfully'
        };
      }),

    // Get knowledge base processing status
    getKnowledgeBaseStatus: this.trpc.procedure
      .input(z.object({
        companyId: z.string(),
        knowledgeBaseId: z.string()
      }))
      .query(async ({ input }) => {
        const { companyId, knowledgeBaseId } = input;

        const knowledgeBase = await KnowledgeBase.findOne({
          _id: knowledgeBaseId,
          companyId
        }).lean();

        if (!knowledgeBase) {
          throw new NotFoundException('Knowledge base not found');
        }        return {
          id: knowledgeBase._id,
          title: knowledgeBase.filename,
          status: knowledgeBase.processingStatus,
          chunksCount: knowledgeBase.chunksCount,
          uploadedAt: knowledgeBase.createdAt,
          processingProgress: knowledgeBase.processingStatus === 'processing' ? 50 : 100
        };
      })
  });
}
