import { db } from '@/config/database';

export interface UsageEvent {
  userId: string;
  action: 'document_upload' | 'document_processed' | 'ai_query' | 'ai_summary' | 'ai_classify' | 'table_extract' | 'ocr_process';
  resourceId?: string;
  quantity?: number;
  creditsUsed?: number;
  metadata?: Record<string, any>;
}

export class UsageLogger {
  static async logEvent(event: UsageEvent): Promise<void> {
    try {
      const {
        userId,
        action,
        resourceId,
        quantity = 1,
        creditsUsed = 0,
        metadata = {},
      } = event;

      await db.query(
        `INSERT INTO usage_logs (user_id, action, resource_id, quantity, credits_used, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [userId, action, resourceId, quantity, creditsUsed, JSON.stringify(metadata)]
      );

      console.log(`📊 Usage logged: ${action} for user ${userId}`);
    } catch (error) {
      console.error('Failed to log usage event:', error);
      // Don't throw - usage logging should not break the main flow
    }
  }

  static async logDocumentUpload(
    userId: string, 
    documentId: string, 
    fileSizeMB: number,
    metadata: { fileName: string; mimeType: string }
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: 'document_upload',
      resourceId: documentId,
      quantity: 1,
      creditsUsed: Math.ceil(fileSizeMB * 0.1), // 0.1 credits per MB
      metadata: {
        ...metadata,
        fileSizeMB,
      },
    });
  }

  static async logDocumentProcessed(
    userId: string,
    documentId: string,
    pages: number,
    processingTimeMs: number,
    metadata: { tablesCount?: number; ocrUsed?: boolean; textLength?: number }
  ): Promise<void> {
    let creditsUsed = pages * 0.05; // Base: 0.05 credits per page
    
    // Additional costs
    if (metadata.tablesCount && metadata.tablesCount > 0) {
      creditsUsed += metadata.tablesCount * 0.1; // 0.1 credits per table
    }
    
    if (metadata.ocrUsed) {
      creditsUsed += pages * 0.2; // 0.2 additional credits per page for OCR
    }

    await this.logEvent({
      userId,
      action: 'document_processed',
      resourceId: documentId,
      quantity: pages,
      creditsUsed: Math.ceil(creditsUsed),
      metadata: {
        ...metadata,
        processingTimeMs,
        creditsBreakdown: {
          basePages: pages * 0.05,
          tables: metadata.tablesCount ? metadata.tablesCount * 0.1 : 0,
          ocr: metadata.ocrUsed ? pages * 0.2 : 0,
        },
      },
    });
  }

  static async logAIQuery(
    userId: string,
    documentId: string,
    question: string,
    tokensUsed: number,
    processingTimeMs: number,
    model: string
  ): Promise<void> {
    const creditsUsed = Math.ceil(tokensUsed * 0.001); // 0.001 credits per token

    await this.logEvent({
      userId,
      action: 'ai_query',
      resourceId: documentId,
      quantity: 1,
      creditsUsed,
      metadata: {
        questionLength: question.length,
        tokensUsed,
        processingTimeMs,
        model,
      },
    });
  }

  static async logAISummary(
    userId: string,
    documentId: string,
    summaryType: string,
    tokensUsed: number,
    model: string
  ): Promise<void> {
    const creditsUsed = Math.ceil(tokensUsed * 0.001); // 0.001 credits per token

    await this.logEvent({
      userId,
      action: 'ai_summary',
      resourceId: documentId,
      quantity: 1,
      creditsUsed,
      metadata: {
        summaryType,
        tokensUsed,
        model,
      },
    });
  }

  static async logAIClassification(
    userId: string,
    documentId: string,
    classification: string,
    confidence: number,
    tokensUsed: number,
    model: string
  ): Promise<void> {
    const creditsUsed = Math.ceil(tokensUsed * 0.0005); // 0.0005 credits per token (cheaper than summaries)

    await this.logEvent({
      userId,
      action: 'ai_classify',
      resourceId: documentId,
      quantity: 1,
      creditsUsed,
      metadata: {
        classification,
        confidence,
        tokensUsed,
        model,
      },
    });
  }

  static async deductUserCredits(userId: string, creditsToDeduct: number): Promise<void> {
    try {
      const result = await db.query(
        'UPDATE users SET credits_remaining = GREATEST(0, credits_remaining - $1) WHERE id = $2 RETURNING credits_remaining',
        [creditsToDeduct, userId]
      );

      const remainingCredits = result.rows[0]?.credits_remaining;
      console.log(`💳 Deducted ${creditsToDeduct} credits from user ${userId}, remaining: ${remainingCredits}`);

      // Log warning if credits are low
      if (remainingCredits < 10) {
        console.warn(`⚠️ User ${userId} has low credits: ${remainingCredits}`);
      }

    } catch (error) {
      console.error('Failed to deduct user credits:', error);
      throw new Error('Credit deduction failed');
    }
  }

  static async getUserCredits(userId: string): Promise<number> {
    try {
      const result = await db.query(
        'SELECT credits_remaining FROM users WHERE id = $1',
        [userId]
      );

      return result.rows[0]?.credits_remaining || 0;
    } catch (error) {
      console.error('Failed to get user credits:', error);
      return 0;
    }
  }

  static async checkCreditsAndDeduct(userId: string, requiredCredits: number): Promise<boolean> {
    const currentCredits = await this.getUserCredits(userId);
    
    if (currentCredits < requiredCredits) {
      console.warn(`❌ Insufficient credits for user ${userId}: has ${currentCredits}, needs ${requiredCredits}`);
      return false;
    }

    await this.deductUserCredits(userId, requiredCredits);
    return true;
  }

  // Get usage statistics for a user
  static async getUserUsageStats(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    documentsProcessed: number;
    pagesProcessed: number;
    aiQueries: number;
    tokensUsed: number;
    creditsUsed: number;
    actions: Record<string, number>;
  }> {
    try {
      const result = await db.query(
        `SELECT 
          action,
          COUNT(*) as count,
          SUM(quantity) as total_quantity,
          SUM(credits_used) as total_credits,
          SUM((metadata->>'tokensUsed')::int) as total_tokens
        FROM usage_logs 
        WHERE user_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        GROUP BY action`,
        [userId, startDate, endDate]
      );

      const stats = {
        documentsProcessed: 0,
        pagesProcessed: 0,
        aiQueries: 0,
        tokensUsed: 0,
        creditsUsed: 0,
        actions: {} as Record<string, number>,
      };

      for (const row of result.rows) {
        const action = row.action;
        const count = parseInt(row.count) || 0;
        const quantity = parseInt(row.total_quantity) || 0;
        const credits = parseInt(row.total_credits) || 0;
        const tokens = parseInt(row.total_tokens) || 0;

        stats.actions[action] = count;
        stats.creditsUsed += credits;
        stats.tokensUsed += tokens;

        if (action === 'document_processed') {
          stats.documentsProcessed += count;
          stats.pagesProcessed += quantity;
        } else if (action === 'ai_query') {
          stats.aiQueries += count;
        }
      }

      return stats;
    } catch (error) {
      console.error('Failed to get user usage stats:', error);
      return {
        documentsProcessed: 0,
        pagesProcessed: 0,
        aiQueries: 0,
        tokensUsed: 0,
        creditsUsed: 0,
        actions: {},
      };
    }
  }
}