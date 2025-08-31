import { env } from './env';

// Simple in-memory database for development
class MockDatabase {
  private users: Map<string, any> = new Map();
  private documents: Map<string, any> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private chunks: Map<string, any> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private queries: Map<string, any> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private usageLogs: Map<string, any> = new Map();

  // Mock query method that simulates SQL queries
  async query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> {
    console.log(`🗄️ Mock DB Query: ${sql}`, params);

    // Handle different query types
    if (sql.includes('SELECT') && sql.includes('users')) {
      return this.handleUserQueries(sql, params);
    }
    
    if (sql.includes('INSERT INTO users')) {
      return this.handleUserInsert(sql, params);
    }

    if (sql.includes('documents')) {
      return this.handleDocumentQueries(sql, params);
    }

    // Default response for unhandled queries
    return { rows: [], rowCount: 0 };
  }

  private handleUserQueries(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    // Handle authentication query for recent users
    if (sql.includes('last_active > NOW()') || sql.includes('ORDER BY last_active')) {
      const allUsers = Array.from(this.users.values());
      return { rows: allUsers, rowCount: allUsers.length };
    }

    if (sql.includes('SELECT * FROM users')) {
      const allUsers = Array.from(this.users.values());
      return { rows: allUsers, rowCount: allUsers.length };
    }

    if (params && params.length > 0) {
      const userId = params[0];
      const user = this.users.get(userId);
      return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
    }

    return { rows: [], rowCount: 0 };
  }

  private handleUserInsert(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    if (params && params.length >= 5) {
      const [email, company, plan, apiKeyHash, apiSecretHash] = params;
      const user = {
        id: this.generateUUID(),
        email,
        company,
        plan,
        api_key_hash: apiKeyHash,
        api_secret_hash: apiSecretHash,
        credits_remaining: plan === 'free' ? 100 : plan === 'pro' ? 5000 : 25000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        metadata: {},
      };

      this.users.set(user.id, user);
      return { rows: [user], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }

  private handleDocumentQueries(sql: string, params?: any[]): { rows: any[]; rowCount: number } {
    if (sql.includes('INSERT INTO documents')) {
      if (params && params.length >= 7) {
        const [userId, originalName, s3Key, sizeBytes, mimeType, checksum, status] = params;
        const document = {
          id: this.generateUUID(),
          user_id: userId,
          original_name: originalName,
          s3_key: s3Key,
          size_bytes: sizeBytes,
          mime_type: mimeType,
          checksum,
          status,
          pages: 0,
          extracted_text: null,
          processing_time_ms: null,
          error_message: null,
          created_at: new Date().toISOString(),
          processed_at: null,
          expires_at: null,
          metadata: {},
        };

        this.documents.set(document.id, document);
        return { rows: [document], rowCount: 1 };
      }
    }

    if (sql.includes('SELECT * FROM documents WHERE user_id')) {
      if (params && params[0]) {
        const userId = params[0];
        const userDocs = Array.from(this.documents.values()).filter(doc => doc.user_id === userId);
        // Sort by created_at DESC
        userDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { rows: userDocs, rowCount: userDocs.length };
      }
    }

    if (sql.includes('SELECT * FROM documents WHERE id')) {
      if (params && params[0]) {
        const doc = this.documents.get(params[0]);
        return { rows: doc ? [doc] : [], rowCount: doc ? 1 : 0 };
      }
    }

    if (sql.includes('UPDATE documents SET')) {
      if (params && params.length > 0) {
        const documentId = params[0]; // First param is always document ID
        const document = this.documents.get(documentId);
        
        if (document) {
          // Mock update - handle comprehensive update
          if (params.length >= 4) {
            // Full update with status, extracted_text, metadata
            document.status = params[1];
            document.extracted_text = params[2];
            document.pages = 1; // Mock page count
            document.processing_time_ms = 1500; // Mock processing time
            document.processed_at = new Date().toISOString();
            
            try {
              document.metadata = JSON.parse(params[3]);
            } catch {
              document.metadata = {};
            }
          } else if (params.length >= 2) {
            // Simple status update
            document.status = params[1];
            document.processed_at = new Date().toISOString();
          }

          this.documents.set(documentId, document);
          return { rows: [document], rowCount: 1 };
        }
      }
    }

    return { rows: [], rowCount: 0 };
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Initialize with a test user
  async init(): Promise<void> {
    const testUser = {
      id: this.generateUUID(),
      email: 'test@paperflow.dev',
      company: 'PaperFlow Test',
      plan: 'pro',
      api_key_hash: '$2b$10$mock.hash.for.development.only',
      api_secret_hash: '$2b$10$mock.secret.hash.for.development.only',
      credits_remaining: 5000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      metadata: {},
    };

    this.users.set(testUser.id, testUser);
    console.log('🧪 Mock database initialized with test user:', testUser.email);
  }
}

// Create singleton instance
export const mockDb = new MockDatabase();

// Database connection interface that works for both real and mock
export interface DatabaseConnection {
  query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }>;
}

// Export the appropriate database connection
export const db: DatabaseConnection = env.NODE_ENV === 'development' ? mockDb : require('./database').db;