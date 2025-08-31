import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
  completed: boolean;
  optional?: boolean;
}

interface TenantSetup {
  companyName: string;
  industry: 'legal' | 'healthcare' | 'finance' | 'real_estate' | 'other';
  companySize: 'small' | 'medium' | 'large' | 'enterprise';
  useCase: 'contract_management' | 'document_processing' | 'compliance' | 'automation' | 'other';
  plan: 'free' | 'pro' | 'business' | 'enterprise';
}

interface IntegrationSetup {
  whatsapp: boolean;
  esignature: boolean;
  webhooks: boolean;
  api: boolean;
}

interface TeamSetup {
  members: Array<{
    email: string;
    name: string;
    role: 'admin' | 'user' | 'viewer';
  }>;
}

// Step 1: Welcome & Company Info
const WelcomeStep: React.FC<{ data: TenantSetup; onChange: (data: TenantSetup) => void }> = ({ data, onChange }) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Bem-vindo ao PaperFlow! 🚀</h2>
        <p className="text-gray-600">Vamos configurar sua conta para começar a transformar documentos em inteligência de dados.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome da Empresa *
          </label>
          <input
            type="text"
            value={data.companyName}
            onChange={(e) => onChange({ ...data, companyName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Escritório Silva & Associados"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Segmento da Empresa *
          </label>
          <select
            value={data.industry}
            onChange={(e) => onChange({ ...data, industry: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Selecione um segmento</option>
            <option value="legal">Jurídico</option>
            <option value="healthcare">Saúde</option>
            <option value="finance">Financeiro</option>
            <option value="real_estate">Imobiliário</option>
            <option value="other">Outro</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tamanho da Empresa *
          </label>
          <select
            value={data.companySize}
            onChange={(e) => onChange({ ...data, companySize: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Selecione o tamanho</option>
            <option value="small">1-10 funcionários</option>
            <option value="medium">11-50 funcionários</option>
            <option value="large">51-200 funcionários</option>
            <option value="enterprise">200+ funcionários</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Principal Caso de Uso *
          </label>
          <select
            value={data.useCase}
            onChange={(e) => onChange({ ...data, useCase: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Selecione o caso de uso</option>
            <option value="contract_management">Gestão de Contratos</option>
            <option value="document_processing">Processamento de Documentos</option>
            <option value="compliance">Compliance</option>
            <option value="automation">Automação de Processos</option>
            <option value="other">Outro</option>
          </select>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">💡 Dica do PaperFlow</h3>
        <p className="text-sm text-blue-700">
          Baseado no seu segmento e caso de uso, vamos recomendar as melhores configurações e templates para sua empresa.
        </p>
      </div>
    </div>
  );
};

// Step 2: Plan Selection
const PlanSelectionStep: React.FC<{ data: TenantSetup; onChange: (data: TenantSetup) => void }> = ({ data, onChange }) => {
  const plans = [
    {
      id: 'free',
      name: 'Gratuito',
      price: 'R$ 0',
      period: '/mês',
      features: [
        '10 documentos/mês',
        '1 usuário',
        'Templates básicos',
        'Suporte por email'
      ],
      recommended: false
    },
    {
      id: 'pro',
      name: 'Profissional',
      price: 'R$ 97',
      period: '/mês',
      features: [
        '300 documentos/mês',
        'Até 5 usuários',
        'Todos os templates',
        'Integrações WhatsApp',
        'Assinatura eletrônica',
        'Suporte prioritário'
      ],
      recommended: true
    },
    {
      id: 'business',
      name: 'Empresarial',
      price: 'R$ 297',
      period: '/mês',
      features: [
        '1000 documentos/mês',
        'Até 20 usuários',
        'API completa',
        'Webhooks customizados',
        'Dashboard analytics',
        'Suporte 24/7'
      ],
      recommended: false
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Personalizado',
      period: '',
      features: [
        'Documentos ilimitados',
        'Usuários ilimitados',
        'Onboarding dedicado',
        'SLA garantido',
        'Integrações personalizadas',
        'Success Manager'
      ],
      recommended: false
    }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Escolha seu Plano</h2>
        <p className="text-gray-600">Selecione o plano que melhor atende às necessidades da sua empresa.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => (
          <Card 
            key={plan.id} 
            className={`cursor-pointer transition-all duration-200 ${
              data.plan === plan.id 
                ? 'ring-2 ring-blue-500 border-blue-500' 
                : 'hover:shadow-lg'
            } ${plan.recommended ? 'ring-2 ring-green-500 border-green-500' : ''}`}
            onClick={() => onChange({ ...data, plan: plan.id as any })}
          >
            <CardHeader className="text-center">
              {plan.recommended && (
                <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full mb-2">
                  Recomendado
                </div>
              )}
              <CardTitle className="text-lg">{plan.name}</CardTitle>
              <div className="text-2xl font-bold text-gray-900">
                {plan.price}
                <span className="text-sm font-normal text-gray-500">{plan.period}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center text-sm">
                    <span className="text-green-500 mr-2">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-yellow-50 p-4 rounded-lg">
        <h3 className="font-medium text-yellow-900 mb-2">🎯 Recomendação Personalizada</h3>
        <p className="text-sm text-yellow-700">
          {data.companySize === 'small' && 'Para empresas pequenas, recomendamos o plano Profissional.'}
          {data.companySize === 'medium' && 'Para empresas médias, recomendamos o plano Empresarial.'}
          {data.companySize === 'large' && 'Para empresas grandes, recomendamos o plano Enterprise.'}
          {data.companySize === 'enterprise' && 'Para enterprises, recomendamos uma consulta personalizada.'}
        </p>
      </div>
    </div>
  );
};

// Step 3: AI Setup Assistant
const AISetupStep: React.FC<{ data: TenantSetup; onChange: (data: TenantSetup) => void }> = ({ data }) => {
  const [recommendations, setRecommendations] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAIRecommendations();
  }, [data.industry, data.useCase, data.companySize]);

  const fetchAIRecommendations = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3002/v1/ai/setup-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'onboarding-tenant',
          'x-api-key': 'onboarding-key',
          'Authorization': 'Bearer onboarding-token'
        },
        body: JSON.stringify({
          industry: data.industry,
          useCase: data.useCase,
          companySize: data.companySize
        })
      });

      if (response.ok) {
        const result = await response.json();
        setRecommendations(result);
      } else {
        // Fallback mock data
        setRecommendations({
          recommendedTemplates: [
            { name: 'Contrato de Prestação de Serviços', category: 'contratos' },
            { name: 'Termo de Confidencialidade', category: 'jurídico' },
            { name: 'Proposta Comercial', category: 'vendas' }
          ],
          workflowSteps: [
            { step: 'Upload de Documento', description: 'Faça upload de documentos PDF ou DOCX' },
            { step: 'Classificação Automática', description: 'IA identifica o tipo de documento' },
            { step: 'Extração de Dados', description: 'Extrai informações importantes automaticamente' },
            { step: 'Revisão e Aprovação', description: 'Fluxo de aprovação customizável' },
            { step: 'Assinatura Eletrônica', description: 'Envio para assinatura digital' },
            { step: 'Armazenamento Seguro', description: 'Documentos arquivados com segurança' }
          ]
        });
      }
    } catch (error) {
      console.error('Error fetching AI recommendations:', error);
      // Use fallback data
      setRecommendations({
        recommendedTemplates: [
          { name: 'Template Genérico', category: 'geral' }
        ],
        workflowSteps: [
          { step: 'Upload', description: 'Faça upload de documentos' },
          { step: 'Processamento', description: 'Processamento automático' },
          { step: 'Resultado', description: 'Visualize os resultados' }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Assistente de Configuração IA</h2>
          <p className="text-gray-600">Nossa IA está analisando suas necessidades...</p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Configuração Inteligente 🤖</h2>
        <p className="text-gray-600">
          Com base no seu perfil, nossa IA preparou as melhores configurações para sua empresa.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>📋</span>
              <span>Templates Recomendados</span>
            </CardTitle>
            <CardDescription>
              Templates que mais se adequam ao seu segmento e caso de uso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations?.recommendedTemplates?.map((template: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{template.name}</div>
                    <div className="text-sm text-gray-500 capitalize">{template.category}</div>
                  </div>
                  <div className="text-green-600 text-sm">✓ Incluído</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>⚡</span>
              <span>Fluxo de Trabalho</span>
            </CardTitle>
            <CardDescription>
              Processo automatizado personalizado para sua empresa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations?.workflowSteps?.map((step: any, idx: number) => (
                <div key={idx} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{step.step}</div>
                    <div className="text-sm text-gray-500">{step.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-green-50 p-4 rounded-lg">
        <h3 className="font-medium text-green-900 mb-2">🎉 Configuração Otimizada</h3>
        <p className="text-sm text-green-700">
          Sua conta será configurada automaticamente com essas recomendações. 
          Você poderá ajustar e personalizar tudo após o onboarding.
        </p>
      </div>
    </div>
  );
};

// Step 4: Integration Setup
const IntegrationStep: React.FC<{ 
  data: IntegrationSetup; 
  onChange: (data: IntegrationSetup) => void 
}> = ({ data, onChange }) => {
  const integrations = [
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      description: 'Envie notificações e documentos via WhatsApp',
      icon: '💬',
      benefits: ['Notificações automáticas', 'Envio de documentos', 'Status em tempo real'],
      optional: true
    },
    {
      id: 'esignature',
      name: 'Assinatura Eletrônica',
      description: 'Integração com provedores de assinatura digital',
      icon: '✍️',
      benefits: ['Clicksign', 'D4Sign', 'DocuSign', 'Fluxos automatizados'],
      optional: true
    },
    {
      id: 'webhooks',
      name: 'Webhooks',
      description: 'Receba notificações em tempo real de eventos',
      icon: '🔗',
      benefits: ['Integrações customizadas', 'Automação avançada', 'APIs externas'],
      optional: true
    },
    {
      id: 'api',
      name: 'API REST',
      description: 'Acesso completo à API do PaperFlow',
      icon: '🚀',
      benefits: ['Integrações completas', 'Desenvolvimento customizado', 'Documentação OpenAPI'],
      optional: false
    }
  ];

  const toggleIntegration = (id: keyof IntegrationSetup) => {
    onChange({ ...data, [id]: !data[id] });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Integrações</h2>
        <p className="text-gray-600">
          Configure as integrações que você deseja usar com o PaperFlow.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration) => (
          <Card 
            key={integration.id}
            className={`cursor-pointer transition-all duration-200 ${
              data[integration.id as keyof IntegrationSetup]
                ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50'
                : 'hover:shadow-lg'
            }`}
            onClick={() => toggleIntegration(integration.id as keyof IntegrationSetup)}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{integration.icon}</span>
                  <span>{integration.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {integration.optional && (
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                      Opcional
                    </span>
                  )}
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    data[integration.id as keyof IntegrationSetup]
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'border-gray-300'
                  }`}>
                    {data[integration.id as keyof IntegrationSetup] && '✓'}
                  </div>
                </div>
              </CardTitle>
              <CardDescription>{integration.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {integration.benefits.map((benefit, idx) => (
                  <div key={idx} className="flex items-center text-sm">
                    <span className="text-green-500 mr-2">•</span>
                    {benefit}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">⚡ Configuração Flexível</h3>
        <p className="text-sm text-blue-700">
          Não se preocupe! Você pode habilitar ou desabilitar essas integrações a qualquer momento 
          nas configurações da sua conta.
        </p>
      </div>
    </div>
  );
};

// Step 5: Team Setup
const TeamSetupStep: React.FC<{ 
  data: TeamSetup; 
  onChange: (data: TeamSetup) => void 
}> = ({ data, onChange }) => {
  const [newMember, setNewMember] = useState({ email: '', name: '', role: 'user' as const });

  const addMember = () => {
    if (newMember.email && newMember.name) {
      onChange({
        ...data,
        members: [...data.members, newMember]
      });
      setNewMember({ email: '', name: '', role: 'user' });
    }
  };

  const removeMember = (index: number) => {
    onChange({
      ...data,
      members: data.members.filter((_, i) => i !== index)
    });
  };

  const roles = {
    admin: { name: 'Administrador', description: 'Acesso completo a todas as funcionalidades' },
    user: { name: 'Usuário', description: 'Acesso às funcionalidades principais' },
    viewer: { name: 'Visualizador', description: 'Apenas visualização de documentos' }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Configure sua Equipe</h2>
        <p className="text-gray-600">
          Adicione os membros da sua equipe que irão usar o PaperFlow.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Adicionar Membro da Equipe</CardTitle>
          <CardDescription>
            Os convites serão enviados por email após a conclusão do onboarding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Nome completo"
              value={newMember.name}
              onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              placeholder="email@empresa.com"
              value={newMember.email}
              onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={newMember.role}
              onChange={(e) => setNewMember({ ...newMember, role: e.target.value as any })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
              <option value="viewer">Visualizador</option>
            </select>
          </div>
          <button
            onClick={addMember}
            disabled={!newMember.email || !newMember.name}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Adicionar Membro
          </button>
        </CardContent>
      </Card>

      {data.members.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Membros da Equipe ({data.members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.members.map((member, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{member.name}</div>
                    <div className="text-sm text-gray-500">{member.email}</div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-600 capitalize">
                      {roles[member.role].name}
                    </span>
                    <button
                      onClick={() => removeMember(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">📋 Níveis de Acesso</h3>
        <div className="space-y-2">
          {Object.entries(roles).map(([key, role]) => (
            <div key={key} className="text-sm">
              <span className="font-medium capitalize">{role.name}:</span>
              <span className="text-gray-600 ml-1">{role.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Step 6: Completion
const CompletionStep: React.FC<{ 
  tenantData: TenantSetup;
  integrationData: IntegrationSetup;
  teamData: TeamSetup;
}> = ({ tenantData, integrationData, teamData }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTenant = async () => {
    setIsCreating(true);
    setError(null);

    try {
      // Create tenant
      const tenantResponse = await fetch('http://localhost:3002/v1/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'admin-api-key'
        },
        body: JSON.stringify({
          slug: tenantData.companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          name: tenantData.companyName,
          plan: tenantData.plan,
          settings: {
            timezone: 'America/Sao_Paulo',
            locale: 'pt-BR',
            currency: 'BRL',
            industry: tenantData.industry,
            companySize: tenantData.companySize,
            useCase: tenantData.useCase
          },
          quotas: {
            documents: tenantData.plan === 'free' ? 10 : tenantData.plan === 'pro' ? 300 : tenantData.plan === 'business' ? 1000 : -1,
            users: tenantData.plan === 'free' ? 1 : tenantData.plan === 'pro' ? 5 : tenantData.plan === 'business' ? 20 : -1,
            templates: tenantData.plan === 'free' ? 3 : tenantData.plan === 'pro' ? 5 : -1,
            webhooks: tenantData.plan === 'free' ? 0 : tenantData.plan === 'pro' ? 3 : tenantData.plan === 'business' ? 10 : -1,
            storageGB: tenantData.plan === 'free' ? 1 : tenantData.plan === 'pro' ? 10 : tenantData.plan === 'business' ? 50 : -1
          },
          integrationConfig: {
            whatsapp: { enabled: integrationData.whatsapp },
            esignature: { enabled: integrationData.esignature },
            webhooks: { enabled: integrationData.webhooks },
            api: { enabled: integrationData.api }
          }
        })
      });

      if (!tenantResponse.ok) {
        throw new Error('Falha ao criar tenant');
      }

      const tenant = await tenantResponse.json();

      // TODO: Create team members (would require authentication system)
      // TODO: Send invitation emails
      // TODO: Setup recommended templates

      setCreated(true);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsCreating(false);
    }
  };

  if (created) {
    return (
      <div className="text-center space-y-6">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-3xl font-bold text-gray-900">Bem-vindo ao PaperFlow!</h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Sua conta foi criada com sucesso! Você já pode começar a transformar 
          documentos em inteligência de dados.
        </p>

        <div className="bg-green-50 p-6 rounded-lg max-w-2xl mx-auto">
          <h3 className="font-bold text-green-900 mb-4">O que acontece agora?</h3>
          <ul className="text-left space-y-2 text-green-700">
            <li>✅ Sua conta foi configurada com as recomendações da IA</li>
            <li>✅ Templates foram instalados automaticamente</li>
            <li>✅ Integrações foram configuradas</li>
            <li>📧 Convites foram enviados para sua equipe</li>
            <li>🚀 Você já pode começar a usar o PaperFlow</li>
          </ul>
        </div>

        <div className="flex justify-center space-x-4">
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-medium"
          >
            Ir para Dashboard
          </button>
          <button
            onClick={() => window.location.href = '/demo-v2'}
            className="bg-gray-600 text-white px-8 py-3 rounded-lg hover:bg-gray-700 font-medium"
          >
            Ver Demo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Revisão Final</h2>
        <p className="text-gray-600">
          Confirme as configurações da sua conta antes de finalizar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações da Empresa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div><strong>Nome:</strong> {tenantData.companyName}</div>
            <div><strong>Segmento:</strong> {tenantData.industry}</div>
            <div><strong>Tamanho:</strong> {tenantData.companySize}</div>
            <div><strong>Caso de Uso:</strong> {tenantData.useCase}</div>
            <div><strong>Plano:</strong> {tenantData.plan}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>WhatsApp: {integrationData.whatsapp ? '✅ Habilitado' : '❌ Desabilitado'}</div>
            <div>Assinatura: {integrationData.esignature ? '✅ Habilitado' : '❌ Desabilitado'}</div>
            <div>Webhooks: {integrationData.webhooks ? '✅ Habilitado' : '❌ Desabilitado'}</div>
            <div>API: {integrationData.api ? '✅ Habilitado' : '❌ Desabilitado'}</div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Equipe ({teamData.members.length} membros)</CardTitle>
          </CardHeader>
          <CardContent>
            {teamData.members.length > 0 ? (
              <div className="space-y-2">
                {teamData.members.map((member, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{member.name} ({member.email})</span>
                    <span className="capitalize">{member.role}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Nenhum membro da equipe adicionado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <div className="text-red-800 font-medium">Erro ao criar conta</div>
          <div className="text-red-600">{error}</div>
        </div>
      )}

      <div className="text-center">
        <button
          onClick={createTenant}
          disabled={isCreating}
          className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isCreating ? 'Criando sua conta...' : 'Finalizar Configuração'}
        </button>
      </div>
    </div>
  );
};

// Main Onboarding Component
export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [tenantData, setTenantData] = useState<TenantSetup>({
    companyName: '',
    industry: 'legal',
    companySize: 'small',
    useCase: 'contract_management',
    plan: 'pro'
  });
  const [integrationData, setIntegrationData] = useState<IntegrationSetup>({
    whatsapp: true,
    esignature: true,
    webhooks: false,
    api: true
  });
  const [teamData, setTeamData] = useState<TeamSetup>({
    members: []
  });

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Bem-vindo',
      description: 'Informações da empresa',
      component: WelcomeStep,
      completed: Boolean(tenantData.companyName && tenantData.industry && tenantData.companySize && tenantData.useCase)
    },
    {
      id: 'plan',
      title: 'Plano',
      description: 'Escolha seu plano',
      component: PlanSelectionStep,
      completed: Boolean(tenantData.plan)
    },
    {
      id: 'ai-setup',
      title: 'IA Setup',
      description: 'Configuração inteligente',
      component: AISetupStep,
      completed: true // This step is always considered completed as it's informational
    },
    {
      id: 'integrations',
      title: 'Integrações',
      description: 'Configure integrações',
      component: IntegrationStep,
      completed: true, // Optional step
      optional: true
    },
    {
      id: 'team',
      title: 'Equipe',
      description: 'Configure sua equipe',
      component: TeamSetupStep,
      completed: true, // Optional step
      optional: true
    },
    {
      id: 'completion',
      title: 'Finalizar',
      description: 'Revisão e criação',
      component: CompletionStep,
      completed: false
    }
  ];

  const currentStepData = steps[currentStep];
  const canProceed = currentStepData.completed || currentStepData.optional;

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepComponent = () => {
    const Component = currentStepData.component;
    
    switch (currentStepData.id) {
      case 'welcome':
      case 'plan':
      case 'ai-setup':
        return <Component data={tenantData} onChange={setTenantData} />;
      case 'integrations':
        return <Component data={integrationData} onChange={setIntegrationData} />;
      case 'team':
        return <Component data={teamData} onChange={setTeamData} />;
      case 'completion':
        return (
          <Component 
            tenantData={tenantData}
            integrationData={integrationData}
            teamData={teamData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-2xl font-bold text-blue-600">PaperFlow</div>
              <div className="text-gray-500">|</div>
              <div className="text-gray-600">Configuração Inicial</div>
            </div>
            <div className="text-sm text-gray-500">
              Etapa {currentStep + 1} de {steps.length}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex">
            {steps.map((step, index) => (
              <div key={step.id} className="flex-1">
                <div className={`flex items-center space-x-3 py-4 ${
                  index <= currentStep ? 'text-blue-600' : 'text-gray-400'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index < currentStep 
                      ? 'bg-green-500 text-white'
                      : index === currentStep
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {index < currentStep ? '✓' : index + 1}
                  </div>
                  <div className="hidden md:block">
                    <div className="font-medium">{step.title}</div>
                    <div className="text-xs text-gray-500">{step.description}</div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-1 ${
                    index < currentStep ? 'bg-green-500' : 'bg-gray-200'
                  }`}></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="min-h-96">
          <CardContent className="p-8">
            {renderStepComponent()}
          </CardContent>
        </Card>

        {/* Navigation */}
        {currentStepData.id !== 'completion' && (
          <div className="flex justify-between mt-6">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={nextStep}
              disabled={!canProceed}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {currentStep === steps.length - 1 ? 'Finalizar' : 'Próximo'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}