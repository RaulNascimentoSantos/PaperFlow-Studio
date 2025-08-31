import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StorageAdapter {
  upload(buffer: Buffer, key: string, metadata?: Record<string, any>): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getUrl(key: string): string;
}

export class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;

  constructor(basePath: string = './uploads') {
    this.basePath = path.resolve(basePath);
  }

  async upload(buffer: Buffer, key: string, metadata?: Record<string, any>): Promise<string> {
    try {
      // Ensure directory exists
      const filePath = path.join(this.basePath, key);
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(filePath, buffer);

      // Save metadata if provided
      if (metadata) {
        const metadataPath = filePath + '.metadata.json';
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      }

      console.log(`📁 File uploaded to local storage: ${key}`);
      return key;
    } catch (error) {
      console.error('Local storage upload failed:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async download(key: string): Promise<Buffer> {
    try {
      const filePath = path.join(this.basePath, key);
      const buffer = await fs.readFile(filePath);
      return buffer;
    } catch (error) {
      console.error('Local storage download failed:', error);
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'File not found'}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = path.join(this.basePath, key);
      await fs.unlink(filePath);

      // Also delete metadata if it exists
      const metadataPath = filePath + '.metadata.json';
      try {
        await fs.unlink(metadataPath);
      } catch (err) {
        // Metadata file doesn't exist, that's ok
      }

      console.log(`🗑️ File deleted from local storage: ${key}`);
    } catch (error) {
      console.error('Local storage delete failed:', error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.basePath, key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getUrl(key: string): string {
    // In a real app, this might be a public URL. For local dev, return a local path identifier
    return `local://${key}`;
  }

  // Utility method to generate a unique key
  static generateKey(originalName: string, userId: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9]/g, '-');
    
    return `documents/${userId}/${timestamp}-${random}-${baseName}${ext}`;
  }

  // Get file stats
  async getFileStats(key: string): Promise<{
    size: number;
    created: Date;
    modified: Date;
  } | null> {
    try {
      const filePath = path.join(this.basePath, key);
      const stats = await fs.stat(filePath);
      
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
      };
    } catch {
      return null;
    }
  }

  // Get metadata
  async getMetadata(key: string): Promise<Record<string, any> | null> {
    try {
      const metadataPath = path.join(this.basePath, key + '.metadata.json');
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(metadataContent);
    } catch {
      return null;
    }
  }

  // List files in a directory
  async listFiles(prefix: string = ''): Promise<string[]> {
    try {
      const searchPath = path.join(this.basePath, prefix);
      const files = await fs.readdir(searchPath, { recursive: true });
      
      return files
        .filter(file => typeof file === 'string' && !file.endsWith('.metadata.json'))
        .map(file => path.join(prefix, file as string));
    } catch {
      return [];
    }
  }
}