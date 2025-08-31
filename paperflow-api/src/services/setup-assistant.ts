import { DatabaseService } from './database';
import { 
  WorkflowSuggestion, 
  RecommendedTemplate, 
  WorkflowStep, 
  IntegrationSuggestion 
} from '../types/classification';

interface IndustryProfile {
  name: string;
  commonDocumentTypes: string[];
  typicalWorkflow: string[];
  complianceRequirements: string[];
  integrations: string[];
  averageMetrics: {
    timeReduction: number;
    errorReduction: number;
    complianceScore: number;
  };
}

interface UseCasePattern {
  useCase: string;
  industry: string;
  frequency: number;
  successRate: number;
  avgSetupTime: number;
}

export class SetupAssistant {
  constructor(private db: DatabaseService) {}

  async suggestWorkflow(
    tenantId: string,
    industry: string,
    useCase: string,
    companySize: 'small' | 'medium' | 'large' = 'medium'
  ): Promise<WorkflowSuggestion> {
    try {
      // Analyze patterns from similar tenants
      const similarTenants = await this.findSimilarTenants(industry, useCase, companySize);
      const commonPatterns = await this.extractCommonPatterns(similarTenants);
      
      // Generate personalized suggestions
      const recommendedTemplates = await this.getTopTemplates(industry, useCase);
      const workflowSteps = this.generateWorkflowSteps(industry, useCase, commonPatterns);
      const integrations = await this.suggestIntegrations(industry, companySize);
      const complianceRequirements = this.getComplianceByIndustry(industry);
      
      // Calculate estimates
      const estimatedSetupTime = this.calculateSetupTime(workflowSteps, companySize);
      const expectedROI = this.calculateExpectedROI(industry, commonPatterns);

      return {
        recommendedTemplates,
        workflowSteps,
        integrations,
        complianceRequirements,
        estimatedSetupTime,
        expectedROI
      };
      
    } catch (error) {
      console.error('Error generating workflow suggestion:', error);
      return this.getDefaultSuggestion(industry, useCase);
    }
  }

  private async findSimilarTenants(
    industry: string,
    useCase: string,
    companySize: string
  ): Promise<any[]> {
    try {
      // Mock similar tenant analysis
      // In production, this would query actual tenant data with privacy protection
      const mockSimilarTenants = [
        {
          id: 'tenant-1',
          industry,
          useCase,
          size: companySize,
          setupTime: 45, // minutes
          templatesUsed: 3,
          integrationsActive: 2,
          successMetrics: {
            timeReduction: 65,
            errorReduction: 78,
            complianceScore: 92
          }
        },
        {
          id: 'tenant-2',
          industry,
          useCase,
          size: companySize,
          setupTime: 30,
          templatesUsed: 2,
          integrationsActive: 1,
          successMetrics: {
            timeReduction: 58,
            errorReduction: 71,
            complianceScore: 88
          }
        }
      ];

      return mockSimilarTenants;
    } catch (error) {
      console.error('Error finding similar tenants:', error);
      return [];
    }
  }

  private async extractCommonPatterns(similarTenants: any[]): Promise<any> {
    if (similarTenants.length === 0) {
      return {
        avgSetupTime: 60,
        avgTemplatesUsed: 2,
        avgIntegrations: 1,
        avgTimeReduction: 50,
        avgErrorReduction: 60,
        complianceScore: 85
      };
    }

    return {
      avgSetupTime: this.average(similarTenants.map(t => t.setupTime)),
      avgTemplatesUsed: this.average(similarTenants.map(t => t.templatesUsed)),
      avgIntegrations: this.average(similarTenants.map(t => t.integrationsActive)),
      avgTimeReduction: this.average(similarTenants.map(t => t.successMetrics.timeReduction)),
      avgErrorReduction: this.average(similarTenants.map(t => t.successMetrics.errorReduction)),
      complianceScore: this.average(similarTenants.map(t => t.successMetrics.complianceScore))
    };
  }

  private async getTopTemplates(industry: string, useCase: string): Promise<RecommendedTemplate[]> {
    // Industry-specific template recommendations
    const industryTemplates = this.getIndustryTemplateMap();
    const templates = industryTemplates[industry] || industryTemplates.general;

    return templates.map((template, index) => ({
      templateId: `template-${industry}-${index + 1}`,
      name: template.name,
      description: template.description,
      matchScore: template.matchScore,
      category: template.category,
      estimatedUsage: template.estimatedUsage
    }));
  }

  private getIndustryTemplateMap(): Record<string, any[]> {
    return {
      legal: [
        {
          name: 'Contratos Jurídicos',
          description: 'Template para processamento de contratos, termos e aditivos',
          matchScore: 0.95,
          category: 'contracts',
          estimatedUsage: '80% dos documentos'
        },
        {
          name: 'Petições e Processos',
          description: 'Organização de documentos processuais e petições',
          matchScore: 0.88,
          category: 'legal_documents',
          estimatedUsage: '60% dos documentos'
        },
        {
          name: 'Procurações',
          description: 'Gerenciamento de procurações e poderes',
          matchScore: 0.82,
          category: 'authorizations',
          estimatedUsage: '40% dos documentos'
        }
      ],
      healthcare: [
        {
          name: 'Laudos Médicos',
          description: 'Processamento de laudos, exames e resultados',
          matchScore: 0.92,
          category: 'medical_reports',
          estimatedUsage: '90% dos documentos'
        },
        {
          name: 'ASO e Atestados',
          description: 'Gestão de atestados de saúde ocupacional',
          matchScore: 0.87,
          category: 'occupational_health',
          estimatedUsage: '70% dos documentos'
        },
        {
          name: 'Fichas de Pacientes',
          description: 'Organização de dados de pacientes (LGPD compliant)',
          matchScore: 0.85,
          category: 'patient_records',
          estimatedUsage: '85% dos documentos'
        }
      ],
      finance: [
        {
          name: 'Notas Fiscais',
          description: 'Processamento automatizado de NF-e e documentos fiscais',
          matchScore: 0.94,
          category: 'invoices',
          estimatedUsage: '95% dos documentos'
        },
        {
          name: 'Contratos Financeiros',
          description: 'Gestão de empréstimos, financiamentos e seguros',
          matchScore: 0.89,
          category: 'financial_contracts',
          estimatedUsage: '65% dos documentos'
        },
        {
          name: 'Extratos e Comprovantes',
          description: 'Organização de comprovantes de pagamento',
          matchScore: 0.83,
          category: 'receipts',
          estimatedUsage: '75% dos documentos'
        }
      ],
      education: [
        {
          name: 'Certificados Acadêmicos',
          description: 'Gerenciamento de diplomas e certificados',
          matchScore: 0.91,
          category: 'certificates',
          estimatedUsage: '80% dos documentos'
        },
        {
          name: 'Históricos Escolares',
          description: 'Processamento de históricos e boletins',
          matchScore: 0.86,
          category: 'academic_records',
          estimatedUsage: '70% dos documentos'
        }
      ],
      general: [
        {
          name: 'Documentos de Identidade',
          description: 'Processamento seguro de RG, CPF, CNH',
          matchScore: 0.88,
          category: 'identity',
          estimatedUsage: '60% dos documentos'
        },
        {
          name: 'Contratos Gerais',
          description: 'Template genérico para contratos diversos',
          matchScore: 0.75,
          category: 'contracts',
          estimatedUsage: '50% dos documentos'
        }
      ]
    };
  }

  private generateWorkflowSteps(
    industry: string, 
    useCase: string, 
    patterns: any
  ): WorkflowStep[] {
    const baseSteps: WorkflowStep[] = [
      {
        id: 'setup-tenant',
        name: 'Configuração Inicial',
        description: 'Definir configurações básicas do tenant e preferências',
        order: 1,
        required: true,
        estimatedTime: '5 minutos'
      },
      {
        id: 'configure-templates',
        name: 'Configurar Templates',
        description: `Ativar e personalizar ${Math.ceil(patterns.avgTemplatesUsed)} templates recomendados`,
        order: 2,
        required: true,
        estimatedTime: '15 minutos'
      },
      {
        id: 'setup-workflows',
        name: 'Definir Fluxos de Trabalho',
        description: 'Configurar automações e regras de processamento',
        order: 3,
        required: true,
        estimatedTime: '20 minutos'
      },
      {
        id: 'configure-integrations',
        name: 'Integrar Sistemas',
        description: `Conectar ${patterns.avgIntegrations} integrações essenciais`,
        order: 4,
        required: false,
        estimatedTime: '25 minutos'
      },
      {
        id: 'test-workflow',
        name: 'Testar Configurações',
        description: 'Processar documentos de teste e validar fluxos',
        order: 5,
        required: true,
        estimatedTime: '10 minutos'
      },
      {
        id: 'user-training',
        name: 'Treinamento da Equipe',
        description: 'Orientar usuários sobre o sistema configurado',
        order: 6,
        required: false,
        estimatedTime: '30 minutos'
      }
    ];

    // Add industry-specific steps
    const industrySpecificSteps = this.getIndustrySpecificSteps(industry);
    
    return [...baseSteps, ...industrySpecificSteps].sort((a, b) => a.order - b.order);
  }

  private getIndustrySpecificSteps(industry: string): WorkflowStep[] {
    const industrySteps: Record<string, WorkflowStep[]> = {
      legal: [
        {
          id: 'legal-compliance',
          name: 'Configurar Compliance Jurídico',
          description: 'Definir políticas de retenção e auditoria',
          order: 3.5,
          required: true,
          estimatedTime: '15 minutos'
        }
      ],
      healthcare: [
        {
          id: 'hipaa-compliance',
          name: 'Configurar LGPD/Sigilo Médico',
          description: 'Ativar proteções específicas para dados de saúde',
          order: 3.5,
          required: true,
          estimatedTime: '20 minutos'
        }
      ],
      finance: [
        {
          id: 'financial-compliance',
          name: 'Configurar Compliance Financeiro',
          description: 'Definir regras fiscais e de auditoria',
          order: 3.5,
          required: true,
          estimatedTime: '18 minutos'
        }
      ]
    };

    return industrySteps[industry] || [];
  }

  private async suggestIntegrations(
    industry: string, 
    companySize: string
  ): Promise<IntegrationSuggestion[]> {
    const baseIntegrations: IntegrationSuggestion[] = [
      {
        name: 'WhatsApp Business',
        description: 'Notificações via WhatsApp para aprovações e alertas',
        category: 'notification',
        priority: 'high',
        setupComplexity: 2
      },
      {
        name: 'Email/SMTP',
        description: 'Envio de notificações e relatórios por email',
        category: 'notification',
        priority: 'high',
        setupComplexity: 1
      },
      {
        name: 'Google Drive',
        description: 'Backup automático de documentos processados',
        category: 'storage',
        priority: 'medium',
        setupComplexity: 2
      }
    ];

    // Add industry-specific integrations
    const industryIntegrations = this.getIndustryIntegrations(industry);
    
    // Add company size specific integrations
    const sizeIntegrations = this.getSizeBasedIntegrations(companySize);

    return [...baseIntegrations, ...industryIntegrations, ...sizeIntegrations];
  }

  private getIndustryIntegrations(industry: string): IntegrationSuggestion[] {
    const industryMap: Record<string, IntegrationSuggestion[]> = {
      legal: [
        {
          name: 'e-SAJ/PJe',
          description: 'Integração com sistemas judiciais',
          category: 'compliance',
          priority: 'high',
          setupComplexity: 4
        }
      ],
      healthcare: [
        {
          name: 'TISS/ANS',
          description: 'Integração com sistemas de saúde',
          category: 'compliance',
          priority: 'medium',
          setupComplexity: 5
        }
      ],
      finance: [
        {
          name: 'SPED/NFe',
          description: 'Integração com sistemas fiscais',
          category: 'compliance',
          priority: 'high',
          setupComplexity: 4
        }
      ]
    };

    return industryMap[industry] || [];
  }

  private getSizeBasedIntegrations(size: string): IntegrationSuggestion[] {
    if (size === 'large') {
      return [
        {
          name: 'Active Directory/SSO',
          description: 'Autenticação integrada com sistemas corporativos',
          category: 'authentication',
          priority: 'high',
          setupComplexity: 5
        },
        {
          name: 'ERP Integration',
          description: 'Integração com sistema ERP existente',
          category: 'analytics',
          priority: 'medium',
          setupComplexity: 5
        }
      ];
    }

    return [];
  }

  private getComplianceByIndustry(industry: string): string[] {
    const complianceMap: Record<string, string[]> = {
      legal: [
        'LGPD - Proteção de dados pessoais',
        'Código de Ética da OAB',
        'Sigilo profissional advocatício',
        'Retenção de documentos por 5 anos'
      ],
      healthcare: [
        'LGPD - Dados sensíveis de saúde',
        'Sigilo médico-paciente',
        'CFM - Conselho Federal de Medicina',
        'Anvisa - Regulamentações sanitárias'
      ],
      finance: [
        'LGPD - Dados financeiros',
        'Bacen - Banco Central',
        'CVM - Comissão de Valores Mobiliários',
        'Sarbanes-Oxley (se aplicável)'
      ],
      education: [
        'LGPD - Dados de menores',
        'MEC - Ministério da Educação',
        'Estatuto da Criança e Adolescente',
        'Lei de Acesso à Informação'
      ]
    };

    return complianceMap[industry] || [
      'LGPD - Lei Geral de Proteção de Dados',
      'Marco Civil da Internet',
      'Código de Defesa do Consumidor'
    ];
  }

  private calculateSetupTime(steps: WorkflowStep[], companySize: string): string {
    const totalMinutes = steps.reduce((sum, step) => {
      const minutes = parseInt(step.estimatedTime.split(' ')[0]);
      return sum + minutes;
    }, 0);

    // Adjust for company size
    const multiplier = companySize === 'large' ? 1.5 : companySize === 'small' ? 0.8 : 1.0;
    const adjustedMinutes = Math.round(totalMinutes * multiplier);

    if (adjustedMinutes < 60) {
      return `${adjustedMinutes} minutos`;
    } else {
      const hours = Math.floor(adjustedMinutes / 60);
      const minutes = adjustedMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}min` : `${hours} hora${hours > 1 ? 's' : ''}`;
    }
  }

  private calculateExpectedROI(industry: string, patterns: any): any {
    // Industry-specific ROI adjustments
    const industryMultipliers: Record<string, any> = {
      legal: { time: 1.2, error: 1.4, compliance: 1.3 },
      healthcare: { time: 1.1, error: 1.5, compliance: 1.4 },
      finance: { time: 1.3, error: 1.3, compliance: 1.2 },
      education: { time: 1.0, error: 1.1, compliance: 1.1 }
    };

    const multiplier = industryMultipliers[industry] || { time: 1.0, error: 1.0, compliance: 1.0 };

    return {
      timeReduction: `${Math.round(patterns.avgTimeReduction * multiplier.time)}%`,
      errorReduction: `${Math.round(patterns.avgErrorReduction * multiplier.error)}%`,
      complianceImprovement: `${Math.round(patterns.complianceScore * multiplier.compliance)}%`
    };
  }

  private getDefaultSuggestion(industry: string, useCase: string): WorkflowSuggestion {
    return {
      recommendedTemplates: [
        {
          templateId: 'default-1',
          name: 'Template Básico',
          description: 'Template genérico para processamento de documentos',
          matchScore: 0.7,
          category: 'general',
          estimatedUsage: '70% dos documentos'
        }
      ],
      workflowSteps: [
        {
          id: 'basic-setup',
          name: 'Configuração Básica',
          description: 'Configuração inicial do sistema',
          order: 1,
          required: true,
          estimatedTime: '30 minutos'
        }
      ],
      integrations: [
        {
          name: 'Email',
          description: 'Notificações básicas por email',
          category: 'notification',
          priority: 'medium',
          setupComplexity: 1
        }
      ],
      complianceRequirements: [
        'LGPD - Lei Geral de Proteção de Dados'
      ],
      estimatedSetupTime: '45 minutos',
      expectedROI: {
        timeReduction: '50%',
        errorReduction: '60%',
        complianceImprovement: '80%'
      }
    };
  }

  private average(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : 0;
  }
}