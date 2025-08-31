export interface DocumentClassification {
  primaryType: string;
  confidence: number;
  suggestedTemplate?: string;
  metadata: Record<string, any>;
  extractedEntities: EntityExtraction[];
}

export interface EntityExtraction {
  type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'date' | 'currency' | 'person' | 'organization' | 'address';
  value: string;
  confidence: number;
  position: {
    start: number;
    end: number;
  };
}

export interface DocumentFeatures {
  wordCount: number;
  pageCount: number;
  hasSignature: boolean;
  hasTable: boolean;
  hasLogo: boolean;
  language: string;
  documentStructure: DocumentStructure;
}

export interface DocumentStructure {
  hasHeader: boolean;
  hasFooter: boolean;
  paragraphCount: number;
  sectionCount: number;
  listCount: number;
  tableCount: number;
}

export interface ClassificationResult {
  classification: DocumentClassification;
  features: DocumentFeatures;
  processingTime: number;
  suggestedActions: string[];
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  filters?: {
    dateRange?: {
      start: Date;
      end: Date;
    };
    documentTypes?: string[];
    minSimilarity?: number;
  };
  includeMetadata?: boolean;
}

export interface SearchResult {
  documentId: string;
  title: string;
  content: string;
  similarity: number;
  keywordScore: number;
  combinedScore: number;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface WorkflowSuggestion {
  recommendedTemplates: RecommendedTemplate[];
  workflowSteps: WorkflowStep[];
  integrations: IntegrationSuggestion[];
  complianceRequirements: string[];
  estimatedSetupTime: string;
  expectedROI: {
    timeReduction: string;
    errorReduction: string;
    complianceImprovement: string;
  };
}

export interface RecommendedTemplate {
  templateId: string;
  name: string;
  description: string;
  matchScore: number;
  category: string;
  estimatedUsage: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  order: number;
  required: boolean;
  estimatedTime: string;
}

export interface IntegrationSuggestion {
  name: string;
  description: string;
  category: 'notification' | 'storage' | 'authentication' | 'compliance' | 'analytics';
  priority: 'high' | 'medium' | 'low';
  setupComplexity: number; // 1-5 scale
}