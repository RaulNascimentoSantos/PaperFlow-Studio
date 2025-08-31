import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '@/middleware/auth';
import { db } from '@/config/database';

const usageRoutes: FastifyPluginAsync = async function (fastify) {
  fastify.get(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get usage analytics and metrics for the authenticated user',
        tags: ['Usage'],
        security: [{ ApiKeyAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            period: { 
              type: 'string', 
              description: 'Period in YYYY-MM format',
              pattern: '^\\d{4}-\\d{2}$'
            },
            start_date: {
              type: 'string',
              format: 'date',
              description: 'Start date for custom period (YYYY-MM-DD)'
            },
            end_date: {
              type: 'string', 
              format: 'date',
              description: 'End date for custom period (YYYY-MM-DD)'
            }
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              period: { type: 'string' },
              metrics: {
                type: 'object',
                properties: {
                  documents_processed: { type: 'number' },
                  pages_extracted: { type: 'number' },
                  ai_queries: { type: 'number' },
                  tokens_consumed: { type: 'number' },
                  storage_gb: { type: 'number' },
                  tables_extracted: { type: 'number' },
                  ocr_pages: { type: 'number' },
                },
              },
              cost_breakdown: {
                type: 'object',
                properties: {
                  extraction: { type: 'number' },
                  ai: { type: 'number' },
                  storage: { type: 'number' },
                  total: { type: 'number' },
                },
              },
              quota: {
                type: 'object',
                properties: {
                  plan: { type: 'string' },
                  pages_remaining: { type: 'number' },
                  queries_remaining: { type: 'number' },
                  credits_remaining: { type: 'number' },
                },
              },
              daily_breakdown: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date: { type: 'string' },
                    documents: { type: 'number' },
                    pages: { type: 'number' },
                    queries: { type: 'number' },
                    tokens: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const userId = request.user!.id;
      const { period, start_date, end_date } = request.query as {
        period?: string;
        start_date?: string;
        end_date?: string;
      };

      // Determine date range
      let startDate: string;
      let endDate: string;
      let periodLabel: string;

      if (start_date && end_date) {
        startDate = start_date;
        endDate = end_date;
        periodLabel = `${start_date} to ${end_date}`;
      } else if (period) {
        const year = parseInt(period.substring(0, 4));
        const month = parseInt(period.substring(5, 7));
        startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
        periodLabel = period;
      } else {
        // Default to current month
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
        periodLabel = `${year}-${month.toString().padStart(2, '0')}`;
      }

      // Get user info for quota calculations
      const userResult = await db.query(
        'SELECT plan, credits_remaining FROM users WHERE id = $1',
        [userId]
      );
      const user = userResult.rows[0];

      // Get document metrics
      const documentMetrics = await db.query(`
        SELECT 
          COUNT(*) as documents_processed,
          SUM(pages) as pages_extracted,
          SUM((metadata->>'tables_count')::int) as tables_extracted,
          ROUND(SUM(size_bytes::numeric) / 1024 / 1024 / 1024, 2) as storage_gb,
          SUM(CASE WHEN (metadata->'processing_info'->>'ocr_used')::boolean = true THEN pages ELSE 0 END) as ocr_pages
        FROM documents 
        WHERE user_id = $1 
        AND created_at >= $2::timestamp 
        AND created_at < $3::timestamp
      `, [userId, startDate, endDate]);

      // Get AI query metrics  
      const queryMetrics = await db.query(`
        SELECT 
          COUNT(*) as ai_queries,
          SUM(tokens_used) as tokens_consumed
        FROM queries 
        WHERE user_id = $1 
        AND created_at >= $2::timestamp 
        AND created_at < $3::timestamp
      `, [userId, startDate, endDate]);

      // Get daily breakdown
      const dailyBreakdown = await db.query(`
        SELECT 
          DATE(d.created_at) as date,
          COUNT(d.id) as documents,
          SUM(d.pages) as pages,
          COUNT(q.id) as queries,
          SUM(q.tokens_used) as tokens
        FROM documents d
        LEFT JOIN queries q ON d.id = q.document_id 
          AND q.created_at >= $2::timestamp 
          AND q.created_at < $3::timestamp
        WHERE d.user_id = $1 
        AND d.created_at >= $2::timestamp 
        AND d.created_at < $3::timestamp
        GROUP BY DATE(d.created_at)
        ORDER BY DATE(d.created_at)
      `, [userId, startDate, endDate]);

      const docMetrics = documentMetrics.rows[0];
      const queryData = queryMetrics.rows[0];

      // Calculate costs (simplified pricing model)
      const extractionCost = (parseInt(docMetrics.pages_extracted) || 0) * 0.01; // $0.01 per page
      const aiCost = (parseInt(queryData.tokens_consumed) || 0) * 0.00001; // $0.00001 per token
      const storageCost = (parseFloat(docMetrics.storage_gb) || 0) * 0.10; // $0.10 per GB per month
      const totalCost = extractionCost + aiCost + storageCost;

      // Plan quotas (from PROMPT_RAIZ)
      const planQuotas: Record<string, { pages: number; queries: number }> = {
        free: { pages: 100, queries: 50 },
        pro: { pages: 5000, queries: 1000 },
        team: { pages: 25000, queries: 10000 },
        enterprise: { pages: 999999, queries: 999999 },
      };

      const userPlan = user.plan || 'free';
      const quota = planQuotas[userPlan] || planQuotas.free;

      return {
        period: periodLabel,
        metrics: {
          documents_processed: parseInt(docMetrics.documents_processed) || 0,
          pages_extracted: parseInt(docMetrics.pages_extracted) || 0,
          ai_queries: parseInt(queryData.ai_queries) || 0,
          tokens_consumed: parseInt(queryData.tokens_consumed) || 0,
          storage_gb: parseFloat(docMetrics.storage_gb) || 0,
          tables_extracted: parseInt(docMetrics.tables_extracted) || 0,
          ocr_pages: parseInt(docMetrics.ocr_pages) || 0,
        },
        cost_breakdown: {
          extraction: Number(extractionCost.toFixed(2)),
          ai: Number(aiCost.toFixed(2)),
          storage: Number(storageCost.toFixed(2)),
          total: Number(totalCost.toFixed(2)),
        },
        quota: {
          plan: userPlan,
          pages_remaining: Math.max(0, quota.pages - (parseInt(docMetrics.pages_extracted) || 0)),
          queries_remaining: Math.max(0, quota.queries - (parseInt(queryData.ai_queries) || 0)),
          credits_remaining: user.credits_remaining || 0,
        },
        daily_breakdown: dailyBreakdown.rows.map(row => ({
          date: row.date,
          documents: parseInt(row.documents) || 0,
          pages: parseInt(row.pages) || 0,
          queries: parseInt(row.queries) || 0,
          tokens: parseInt(row.tokens) || 0,
        })),
      };
    }
  );

  // Get usage statistics for admin users
  fastify.get(
    '/stats',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get system-wide usage statistics (admin only)',
        tags: ['Usage'],
        security: [{ ApiKeyAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              system_stats: {
                type: 'object',
                properties: {
                  total_users: { type: 'number' },
                  active_users_30d: { type: 'number' },
                  total_documents: { type: 'number' },
                  total_pages: { type: 'number' },
                  total_queries: { type: 'number' },
                  total_storage_gb: { type: 'number' },
                },
              },
              plan_distribution: {
                type: 'object',
                properties: {
                  free: { type: 'number' },
                  pro: { type: 'number' },
                  team: { type: 'number' },
                  enterprise: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      // Simple admin check - in production you'd have proper role-based auth
      const userEmail = request.user!.email;
      if (!userEmail.includes('admin') && !userEmail.includes('paperflow')) {
        throw { statusCode: 403, message: 'Admin access required' };
      }

      // Get system-wide statistics
      const systemStats = await db.query(`
        SELECT 
          COUNT(DISTINCT u.id) as total_users,
          COUNT(DISTINCT CASE WHEN u.last_active > NOW() - INTERVAL '30 days' THEN u.id END) as active_users_30d,
          COUNT(DISTINCT d.id) as total_documents,
          SUM(d.pages) as total_pages,
          ROUND(SUM(d.size_bytes::numeric) / 1024 / 1024 / 1024, 2) as total_storage_gb,
          COUNT(DISTINCT q.id) as total_queries
        FROM users u
        LEFT JOIN documents d ON u.id = d.user_id
        LEFT JOIN queries q ON u.id = q.user_id
      `);

      const planDistribution = await db.query(`
        SELECT 
          plan,
          COUNT(*) as count
        FROM users
        GROUP BY plan
      `);

      const stats = systemStats.rows[0];
      const plans = planDistribution.rows.reduce((acc, row) => {
        acc[row.plan] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>);

      return {
        system_stats: {
          total_users: parseInt(stats.total_users) || 0,
          active_users_30d: parseInt(stats.active_users_30d) || 0,
          total_documents: parseInt(stats.total_documents) || 0,
          total_pages: parseInt(stats.total_pages) || 0,
          total_queries: parseInt(stats.total_queries) || 0,
          total_storage_gb: parseFloat(stats.total_storage_gb) || 0,
        },
        plan_distribution: {
          free: plans.free || 0,
          pro: plans.pro || 0,
          team: plans.team || 0,
          enterprise: plans.enterprise || 0,
        },
      };
    }
  );
};

export default usageRoutes;