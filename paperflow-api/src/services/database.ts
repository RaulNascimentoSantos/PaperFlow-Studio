import { db } from '@/config/database';

export interface QueryResult {
  rows: any[];
  rowCount: number;
}

export interface DatabaseClient {
  query(text: string, params?: any[]): Promise<QueryResult>;
  release(): void;
}

export class DatabaseService {
  async query(text: string, params?: any[]): Promise<QueryResult> {
    try {
      const result = await db.query(text, params);
      return {
        rows: result.rows || [],
        rowCount: result.rowCount || 0
      };
    } catch (error) {
      console.error('Database query error:', error);
      console.error('Query:', text);
      console.error('Params:', params);
      throw error;
    }
  }

  async getClient(): Promise<DatabaseClient> {
    const client = await db.connect();
    
    return {
      query: async (text: string, params?: any[]) => {
        try {
          const result = await client.query(text, params);
          return {
            rows: result.rows || [],
            rowCount: result.rowCount || 0
          };
        } catch (error) {
          console.error('Database client query error:', error);
          throw error;
        }
      },
      release: () => client.release()
    };
  }

  async transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<{ status: string; timestamp: Date }> {
    try {
      const result = await this.query('SELECT NOW() as timestamp');
      return {
        status: 'healthy',
        timestamp: result.rows[0]?.timestamp || new Date()
      };
    } catch (error) {
      console.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date()
      };
    }
  }
}

// Export a singleton instance
export const databaseService = new DatabaseService();