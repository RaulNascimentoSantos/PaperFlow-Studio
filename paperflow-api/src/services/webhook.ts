import crypto from 'crypto';
import { db } from '@/config/database';
import { env } from '@/config/env';
import { CustodyChainService } from './custody-chain';

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
  documentId?: string;
}

export class WebhookService {
  /**
   * Gera assinatura HMAC para o payload
   */
  private static generateSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }
  
  /**
   * Verifica se o timestamp não é muito antigo (anti-replay)
   */
  private static isTimestampValid(timestamp: string, maxAgeMs = 300000): boolean {
    const age = Date.now() - new Date(timestamp).getTime();
    return age >= 0 && age <= maxAgeMs;
  }
  
  /**
   * Envia webhook com retry e backoff exponencial
   */
  static async send(
    webhookId: string,
    event: string,
    data: any,
    attemptNumber = 1
  ): Promise<void> {
    const maxAttempts = 3;
    
    try {
      // Buscar webhook
      const webhook = await db.query(
        'SELECT * FROM webhooks WHERE id = $1 AND active = true',
        [webhookId]
      );
      
      if (!webhook.rows.length) {
        throw new Error('Webhook not found or inactive');
      }
      
      const { url, secret, events } = webhook.rows[0];
      
      // Verificar se o evento está configurado
      if (!events.includes(event)) {
        return;
      }
      
      // Preparar payload
      const timestamp = new Date().toISOString();
      const payload: WebhookPayload = {
        event,
        timestamp,
        data,
        ...(data.documentId && { documentId: data.documentId }),
      };
      
      const payloadString = JSON.stringify(payload);
      const signature = this.generateSignature(payloadString, secret);
      
      // Enviar webhook
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PF-Event': event,
          'X-PF-Signature': signature,
          'X-PF-Timestamp': timestamp,
          'X-PF-Version': '1.0',
          'User-Agent': 'PaperFlow-Webhooks/1.0',
        },
        body: payloadString,
        signal: AbortSignal.timeout(10000), // 10s timeout
      });
      
      const responseBody = await response.text();
      
      // Registrar tentativa
      await db.query(
        `INSERT INTO webhook_attempts 
         (webhook_id, event, payload, response_status, response_body, attempt_number) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [webhookId, event, payload, response.status, responseBody, attemptNumber]
      );
      
      // Log da tentativa
      if (response.ok) {
        console.log(`Webhook sent successfully: ${event} to ${url}`);
      } else {
        console.error(`Webhook failed: ${event} to ${url} - Status: ${response.status}`);
      }
      
      // Retry se necessário
      if (!response.ok && attemptNumber < maxAttempts) {
        const delay = Math.pow(2, attemptNumber) * 1000; // Backoff exponencial
        setTimeout(() => {
          this.send(webhookId, event, data, attemptNumber + 1);
        }, delay);
      }
    } catch (error) {
      console.error(`Webhook error: ${error.message}`);
      
      // Registrar erro
      await db.query(
        `INSERT INTO webhook_attempts 
         (webhook_id, event, payload, error_message, attempt_number) 
         VALUES ($1, $2, $3, $4, $5)`,
        [webhookId, event, { data }, error.message, attemptNumber]
      );
      
      // Retry em caso de erro
      if (attemptNumber < maxAttempts) {
        const delay = Math.pow(2, attemptNumber) * 1000;
        setTimeout(() => {
          this.send(webhookId, event, data, attemptNumber + 1);
        }, delay);
      }
    }
  }
  
  /**
   * Dispara webhooks para todos os usuários inscritos em um evento
   */
  static async trigger(userId: string, event: string, data: any): Promise<void> {
    if (!env.ENABLE_WEBHOOKS) {
      return;
    }
    
    try {
      const webhooks = await db.query(
        'SELECT id FROM webhooks WHERE user_id = $1 AND $2 = ANY(events) AND active = true',
        [userId, event]
      );
      
      // Registrar disparo no audit log se relacionado a documento
      if (data.documentId) {
        await CustodyChainService.logAction({
          documentId: data.documentId,
          userId,
          action: 'webhook_triggered',
          actor: 'system',
          payload: {
            event,
            webhookCount: webhooks.rows.length,
          },
        });
      }
      
      // Enviar para todos os webhooks inscritos
      for (const webhook of webhooks.rows) {
        // Processar de forma assíncrona para não bloquear
        this.send(webhook.id, event, data).catch(console.error);
      }
    } catch (error) {
      console.error(`Error triggering webhooks: ${error.message}`);
    }
  }
  
  /**
   * Criar novo webhook para um usuário
   */
  static async create(
    userId: string,
    url: string,
    events: string[]
  ): Promise<{
    id: string;
    secret: string;
  }> {
    // Validar URL
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid webhook URL');
    }
    
    // Validar eventos
    const validEvents = [
      'document.uploaded',
      'document.processing',
      'document.completed',
      'document.failed',
      'bates.completed',
      'pii.detected',
      'redaction.completed',
      'evidence.exported'
    ];
    
    const invalidEvents = events.filter(e => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      throw new Error(`Invalid events: ${invalidEvents.join(', ')}`);
    }
    
    // Gerar secret único
    const secret = crypto.randomBytes(32).toString('hex');
    
    // Criar webhook
    const result = await db.query(
      `INSERT INTO webhooks (user_id, url, events, secret) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [userId, url, events, secret]
    );
    
    return {
      id: result.rows[0].id,
      secret,
    };
  }
  
  /**
   * Listar webhooks de um usuário
   */
  static async list(userId: string): Promise<Array<{
    id: string;
    url: string;
    events: string[];
    active: boolean;
    created_at: string;
    last_attempt?: string;
    success_rate?: number;
  }>> {
    const result = await db.query(
      `SELECT w.*, 
              wa.last_attempt, 
              wa.success_rate
       FROM webhooks w
       LEFT JOIN (
         SELECT webhook_id,
                MAX(created_at) as last_attempt,
                AVG(CASE WHEN response_status BETWEEN 200 AND 299 THEN 1.0 ELSE 0.0 END) as success_rate
         FROM webhook_attempts 
         GROUP BY webhook_id
       ) wa ON w.id = wa.webhook_id
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [userId]
    );
    
    return result.rows.map(row => ({
      id: row.id,
      url: row.url,
      events: row.events,
      active: row.active,
      created_at: row.created_at,
      last_attempt: row.last_attempt,
      success_rate: row.success_rate ? Math.round(row.success_rate * 100) : undefined,
    }));
  }
  
  /**
   * Atualizar webhook
   */
  static async update(
    webhookId: string,
    userId: string,
    updates: {
      url?: string;
      events?: string[];
      active?: boolean;
    }
  ): Promise<void> {
    const setParts: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (updates.url !== undefined) {
      try {
        new URL(updates.url);
      } catch {
        throw new Error('Invalid webhook URL');
      }
      setParts.push(`url = $${paramIndex++}`);
      values.push(updates.url);
    }
    
    if (updates.events !== undefined) {
      setParts.push(`events = $${paramIndex++}`);
      values.push(updates.events);
    }
    
    if (updates.active !== undefined) {
      setParts.push(`active = $${paramIndex++}`);
      values.push(updates.active);
    }
    
    if (setParts.length === 0) {
      throw new Error('No updates provided');
    }
    
    values.push(webhookId, userId);
    
    await db.query(
      `UPDATE webhooks SET ${setParts.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}`,
      values
    );
  }
  
  /**
   * Deletar webhook
   */
  static async delete(webhookId: string, userId: string): Promise<void> {
    await db.query(
      'DELETE FROM webhooks WHERE id = $1 AND user_id = $2',
      [webhookId, userId]
    );
  }
  
  /**
   * Testar webhook enviando evento de teste
   */
  static async test(webhookId: string, userId: string): Promise<void> {
    const webhook = await db.query(
      'SELECT * FROM webhooks WHERE id = $1 AND user_id = $2',
      [webhookId, userId]
    );
    
    if (!webhook.rows.length) {
      throw new Error('Webhook not found');
    }
    
    await this.send(webhookId, 'webhook.test', {
      message: 'This is a test webhook from PaperFlow',
      timestamp: new Date().toISOString(),
    });
  }
  
  /**
   * Verifica assinatura de webhook recebido (para documentação)
   */
  static verifySignature(
    payload: string,
    signature: string,
    secret: string,
    timestamp: string
  ): boolean {
    if (!this.isTimestampValid(timestamp)) {
      return false;
    }
    
    const expectedSignature = this.generateSignature(payload, secret);
    
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }
  
  /**
   * Obter estatísticas de webhook
   */
  static async getStats(webhookId: string, userId: string): Promise<{
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    successRate: number;
    lastAttempt?: string;
    averageResponseTime?: number;
  }> {
    const result = await db.query(
      `SELECT COUNT(*) as total_attempts,
              COUNT(CASE WHEN response_status BETWEEN 200 AND 299 THEN 1 END) as successful_attempts,
              COUNT(CASE WHEN response_status NOT BETWEEN 200 AND 299 OR error_message IS NOT NULL THEN 1 END) as failed_attempts,
              MAX(created_at) as last_attempt
       FROM webhook_attempts wa
       JOIN webhooks w ON wa.webhook_id = w.id
       WHERE wa.webhook_id = $1 AND w.user_id = $2`,
      [webhookId, userId]
    );
    
    const row = result.rows[0];
    const totalAttempts = parseInt(row.total_attempts);
    const successfulAttempts = parseInt(row.successful_attempts);
    const failedAttempts = parseInt(row.failed_attempts);
    
    return {
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      successRate: totalAttempts > 0 ? Math.round((successfulAttempts / totalAttempts) * 100) : 0,
      lastAttempt: row.last_attempt,
    };
  }
}