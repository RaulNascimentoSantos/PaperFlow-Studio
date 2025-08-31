import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

interface DashboardData {
  overview: {
    documentsProcessed: number;
    templatesUsed: number;
    activeIntegrations: number;
    apiCalls: number;
    healthScore: number;
    planUsage: {
      documents: { used: number; limit: number };
      users: { used: number; limit: number };
      storage: { used: number; limit: number };
    };
  };
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    status: 'success' | 'processing' | 'error';
    user?: string;
  }>;
  quickActions: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    action: string;
    enabled: boolean;
  }>;
  alerts: Array<{
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    actionText?: string;
    actionUrl?: string;
  }>;
}

const QuickActionCard: React.FC<{
  action: DashboardData['quickActions'][0];
  onAction: (action: string) => void;
}> = ({ action, onAction }) => {
  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
        action.enabled 
          ? 'border-blue-200 hover:border-blue-400' 
          : 'border-gray-200 bg-gray-50'
      }`}
      onClick={() => action.enabled && onAction(action.action)}
    >
      <CardContent className="p-6">
        <div className="flex items-center space-x-4">
          <div className={`text-3xl ${action.enabled ? '' : 'grayscale opacity-50'}`}>
            {action.icon}
          </div>
          <div className="flex-1">
            <h3 className={`font-semibold ${action.enabled ? 'text-gray-900' : 'text-gray-500'}`}>
              {action.title}
            </h3>
            <p className={`text-sm ${action.enabled ? 'text-gray-600' : 'text-gray-400'}`}>
              {action.description}
            </p>
          </div>
          <div className={`text-2xl ${action.enabled ? 'text-blue-500' : 'text-gray-300'}`}>
            →
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ActivityItem: React.FC<{
  activity: DashboardData['recentActivity'][0];
}> = ({ activity }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'processing': return '⏳';
      case 'error': return '❌';
      default: return '📄';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'processing': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'agora';
    if (diffInMinutes < 60) return `${diffInMinutes}m atrás`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h atrás`;
    return `${Math.floor(diffInMinutes / 1440)}d atrás`;
  };

  return (
    <div className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-shrink-0">
        <span className="text-lg">{getStatusIcon(activity.status)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="font-medium text-gray-900 truncate">{activity.title}</p>
          <span className="text-xs text-gray-500 ml-2">{formatTime(activity.timestamp)}</span>
        </div>
        <p className="text-sm text-gray-600">{activity.description}</p>
        {activity.user && (
          <p className="text-xs text-gray-500 mt-1">por {activity.user}</p>
        )}
      </div>
      <div className={`flex-shrink-0 ${getStatusColor(activity.status)}`}>
        <span className="text-xs font-medium capitalize">{activity.status}</span>
      </div>
    </div>
  );
};

const AlertBanner: React.FC<{
  alert: DashboardData['alerts'][0];
  onDismiss: (id: string) => void;
  onAction: (url: string) => void;
}> = ({ alert, onDismiss, onAction }) => {
  const getAlertStyles = (type: string) => {
    switch (type) {
      case 'error': return 'bg-red-50 border-red-200 text-red-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'success': return 'bg-green-50 border-green-200 text-green-800';
      default: return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return '🚨';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      default: return 'ℹ️';
    }
  };

  return (
    <div className={`p-4 border rounded-lg ${getAlertStyles(alert.type)}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-lg">{getAlertIcon(alert.type)}</span>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="font-medium">{alert.title}</h3>
          <p className="text-sm mt-1 opacity-90">{alert.message}</p>
          <div className="flex items-center space-x-3 mt-2">
            {alert.actionText && alert.actionUrl && (
              <button
                onClick={() => onAction(alert.actionUrl!)}
                className="text-sm font-medium underline hover:no-underline"
              >
                {alert.actionText}
              </button>
            )}
            <button
              onClick={() => onDismiss(alert.id)}
              className="text-sm opacity-75 hover:opacity-100"
            >
              Dispensar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ModernDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      const tenantId = 'test-tenant-123';
      const apiKey = 'test-api-key-for-development';

      // Fetch multiple data sources
      const responses = await Promise.all([
        fetch('http://localhost:3002/v1/metrics/dashboard', {
          headers: { 'x-tenant-id': tenantId, 'x-api-key': apiKey }
        }),
        fetch('http://localhost:3002/v1/billing/usage/current', {
          headers: { 'x-tenant-id': tenantId, 'x-api-key': apiKey }
        }),
        fetch('http://localhost:3002/v1/integrations/config', {
          headers: { 'x-tenant-id': tenantId, 'x-api-key': apiKey }
        })
      ]);

      if (responses.some(r => !r.ok)) {
        throw new Error('Failed to fetch dashboard data');
      }

      const [metricsData, billingData, integrationsData] = await Promise.all(
        responses.map(r => r.json())
      );

      // Mock recent activity
      const recentActivity = [
        {
          id: '1',
          type: 'document_processed',
          title: 'Contrato processado',
          description: 'contrato-servicos-janeiro.pdf foi processado com sucesso',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          status: 'success' as const,
          user: 'João Silva'
        },
        {
          id: '2',
          type: 'template_executed',
          title: 'Template executado',
          description: 'Template "Proposta Comercial" foi executado',
          timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          status: 'success' as const,
          user: 'Maria Santos'
        },
        {
          id: '3',
          type: 'signature_sent',
          title: 'Documento enviado para assinatura',
          description: 'termo-confidencialidade.pdf enviado via Clicksign',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          status: 'processing' as const,
          user: 'Admin'
        },
        {
          id: '4',
          type: 'webhook_received',
          title: 'Webhook recebido',
          description: 'Assinatura concluída - documento finalizado',
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          status: 'success' as const
        },
        {
          id: '5',
          type: 'whatsapp_sent',
          title: 'Notificação WhatsApp',
          description: 'Notificação de documento processado enviada',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          status: 'success' as const,
          user: 'Sistema'
        }
      ];

      // Mock quick actions
      const quickActions = [
        {
          id: 'upload',
          title: 'Processar Documento',
          description: 'Upload e processamento inteligente de documentos',
          icon: '📄',
          action: 'upload-document',
          enabled: true
        },
        {
          id: 'template',
          title: 'Usar Template',
          description: 'Executar workflow com template predefinido',
          icon: '📋',
          action: 'use-template',
          enabled: true
        },
        {
          id: 'signature',
          title: 'Enviar para Assinatura',
          description: 'Envio para assinatura eletrônica',
          icon: '✍️',
          action: 'send-signature',
          enabled: integrationsData.esignature?.enabled || false
        },
        {
          id: 'whatsapp',
          title: 'Notificar via WhatsApp',
          description: 'Enviar notificação ou documento via WhatsApp',
          icon: '💬',
          action: 'send-whatsapp',
          enabled: integrationsData.whatsapp?.enabled || false
        },
        {
          id: 'api',
          title: 'Testar API',
          description: 'Fazer uma chamada de teste para a API',
          icon: '🔗',
          action: 'test-api',
          enabled: true
        },
        {
          id: 'analytics',
          title: 'Ver Analytics',
          description: 'Dashboard completo de métricas e analytics',
          icon: '📊',
          action: 'view-analytics',
          enabled: true
        }
      ];

      // Mock alerts based on health score and usage
      const alerts = [];
      
      if (metricsData.healthScore?.score < 60) {
        alerts.push({
          id: 'low-health',
          type: 'warning' as const,
          title: 'Score de Saúde da Conta Baixo',
          message: `Seu score atual é ${metricsData.healthScore.score}/100. Considere seguir as recomendações para melhorar.`,
          actionText: 'Ver Recomendações',
          actionUrl: '/metrics-dashboard'
        });
      }

      if (billingData.usage?.documents?.percentage > 80) {
        alerts.push({
          id: 'quota-warning',
          type: 'warning' as const,
          title: 'Limite de Documentos Próximo',
          message: 'Você está próximo do limite mensal de documentos. Considere fazer upgrade do plano.',
          actionText: 'Ver Planos',
          actionUrl: '/billing'
        });
      }

      // Success alert for good health
      if (metricsData.healthScore?.score >= 80) {
        alerts.push({
          id: 'good-health',
          type: 'success' as const,
          title: 'Excelente Score de Saúde!',
          message: `Parabéns! Seu score de saúde da conta é ${metricsData.healthScore.score}/100. Continue assim!`
        });
      }

      setData({
        overview: {
          documentsProcessed: metricsData.summary?.totalDocuments || 45,
          templatesUsed: metricsData.summary?.templatesUsed || 8,
          activeIntegrations: [
            integrationsData.whatsapp?.enabled,
            integrationsData.esignature?.enabled,
            integrationsData.api?.enabled
          ].filter(Boolean).length,
          apiCalls: metricsData.summary?.apiCalls || 1250,
          healthScore: metricsData.healthScore?.score || 78,
          planUsage: {
            documents: { 
              used: billingData.usage?.documents?.used || 45, 
              limit: billingData.usage?.documents?.limit || 300 
            },
            users: { 
              used: billingData.usage?.users?.used || 3, 
              limit: billingData.usage?.users?.limit || 5 
            },
            storage: { 
              used: billingData.usage?.storage?.used || 2.1, 
              limit: billingData.usage?.storage?.limit || 10 
            }
          }
        },
        recentActivity,
        quickActions,
        alerts
      });

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      
      // Fallback mock data
      setData({
        overview: {
          documentsProcessed: 45,
          templatesUsed: 8,
          activeIntegrations: 3,
          apiCalls: 1250,
          healthScore: 78,
          planUsage: {
            documents: { used: 45, limit: 300 },
            users: { used: 3, limit: 5 },
            storage: { used: 2.1, limit: 10 }
          }
        },
        recentActivity: [
          {
            id: '1',
            type: 'document_processed',
            title: 'Documento processado',
            description: 'contrato.pdf foi processado com sucesso',
            timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            status: 'success',
            user: 'João Silva'
          }
        ],
        quickActions: [
          {
            id: 'upload',
            title: 'Processar Documento',
            description: 'Upload e processamento de documentos',
            icon: '📄',
            action: 'upload-document',
            enabled: true
          },
          {
            id: 'template',
            title: 'Usar Template',
            description: 'Executar workflow com template',
            icon: '📋',
            action: 'use-template',
            enabled: true
          }
        ],
        alerts: [
          {
            id: 'welcome',
            type: 'info',
            title: 'Bem-vindo ao PaperFlow!',
            message: 'Sua conta foi configurada com sucesso. Comece processando seu primeiro documento.'
          }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'upload-document':
        window.location.href = '/demo-v2';
        break;
      case 'use-template':
        window.location.href = '/templates';
        break;
      case 'send-signature':
        window.location.href = '/integrations/esignature';
        break;
      case 'send-whatsapp':
        window.location.href = '/integrations/whatsapp';
        break;
      case 'test-api':
        window.open('http://localhost:3002/docs', '_blank');
        break;
      case 'view-analytics':
        window.location.href = '/metrics-dashboard';
        break;
      default:
        console.log('Action not implemented:', action);
    }
  };

  const dismissAlert = (id: string) => {
    if (data) {
      setData({
        ...data,
        alerts: data.alerts.filter(alert => alert.id !== id)
      });
    }
  };

  const handleAlertAction = (url: string) => {
    window.location.href = url;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-64"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-96 bg-gray-200 rounded"></div>
              <div className="h-96 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-red-600 text-xl font-semibold mb-2">Erro ao carregar dashboard</div>
              <div className="text-gray-600 mb-4">{error}</div>
              <button
                onClick={fetchDashboardData}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Tentar Novamente
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">Transforme documentos em inteligência de dados</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm text-gray-500">Score de Saúde</div>
                <div className={`text-2xl font-bold ${getHealthScoreColor(data.overview.healthScore)}`}>
                  {data.overview.healthScore}/100
                </div>
              </div>
              <div className="text-gray-300">|</div>
              <button
                onClick={fetchDashboardData}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Atualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Alerts */}
        {data.alerts.length > 0 && (
          <div className="space-y-4">
            {data.alerts.map(alert => (
              <AlertBanner
                key={alert.id}
                alert={alert}
                onDismiss={dismissAlert}
                onAction={handleAlertAction}
              />
            ))}
          </div>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Documentos Processados</p>
                  <p className="text-3xl font-bold text-gray-900">{data.overview.documentsProcessed}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {data.overview.planUsage.documents.used} de {data.overview.planUsage.documents.limit} este mês
                  </p>
                </div>
                <div className="text-blue-600 bg-blue-50 p-3 rounded-full">
                  📄
                </div>
              </div>
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${getUsageColor(
                      (data.overview.planUsage.documents.used / data.overview.planUsage.documents.limit) * 100
                    )}`}
                    style={{ 
                      width: `${Math.min(100, (data.overview.planUsage.documents.used / data.overview.planUsage.documents.limit) * 100)}%` 
                    }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Templates Utilizados</p>
                  <p className="text-3xl font-bold text-gray-900">{data.overview.templatesUsed}</p>
                  <p className="text-xs text-gray-500 mt-1">Workflows automatizados</p>
                </div>
                <div className="text-green-600 bg-green-50 p-3 rounded-full">
                  📋
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Integrações Ativas</p>
                  <p className="text-3xl font-bold text-gray-900">{data.overview.activeIntegrations}</p>
                  <p className="text-xs text-gray-500 mt-1">WhatsApp, Assinatura, API</p>
                </div>
                <div className="text-purple-600 bg-purple-50 p-3 rounded-full">
                  🔌
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Chamadas API</p>
                  <p className="text-3xl font-bold text-gray-900">{data.overview.apiCalls.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">Este mês</p>
                </div>
                <div className="text-yellow-600 bg-yellow-50 p-3 rounded-full">
                  🔗
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Usage Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>📊</span>
              <span>Uso do Plano</span>
            </CardTitle>
            <CardDescription>Acompanhe o uso dos recursos do seu plano atual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Documentos</span>
                  <span className="text-sm text-gray-500">
                    {data.overview.planUsage.documents.used} / {data.overview.planUsage.documents.limit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full ${getUsageColor(
                      (data.overview.planUsage.documents.used / data.overview.planUsage.documents.limit) * 100
                    )}`}
                    style={{ 
                      width: `${Math.min(100, (data.overview.planUsage.documents.used / data.overview.planUsage.documents.limit) * 100)}%` 
                    }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {Math.round((data.overview.planUsage.documents.used / data.overview.planUsage.documents.limit) * 100)}% usado
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Usuários</span>
                  <span className="text-sm text-gray-500">
                    {data.overview.planUsage.users.used} / {data.overview.planUsage.users.limit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full ${getUsageColor(
                      (data.overview.planUsage.users.used / data.overview.planUsage.users.limit) * 100
                    )}`}
                    style={{ 
                      width: `${Math.min(100, (data.overview.planUsage.users.used / data.overview.planUsage.users.limit) * 100)}%` 
                    }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {Math.round((data.overview.planUsage.users.used / data.overview.planUsage.users.limit) * 100)}% usado
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Armazenamento</span>
                  <span className="text-sm text-gray-500">
                    {data.overview.planUsage.storage.used}GB / {data.overview.planUsage.storage.limit}GB
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full ${getUsageColor(
                      (data.overview.planUsage.storage.used / data.overview.planUsage.storage.limit) * 100
                    )}`}
                    style={{ 
                      width: `${Math.min(100, (data.overview.planUsage.storage.used / data.overview.planUsage.storage.limit) * 100)}%` 
                    }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {Math.round((data.overview.planUsage.storage.used / data.overview.planUsage.storage.limit) * 100)}% usado
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Quick Actions */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Ações Rápidas</h2>
            <div className="space-y-4">
              {data.quickActions.map(action => (
                <QuickActionCard
                  key={action.id}
                  action={action}
                  onAction={handleQuickAction}
                />
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>⚡</span>
                <span>Atividade Recente</span>
              </CardTitle>
              <CardDescription>Últimas ações realizadas na sua conta</CardDescription>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
              {data.recentActivity.length > 0 ? (
                <div>
                  {data.recentActivity.map(activity => (
                    <ActivityItem key={activity.id} activity={activity} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Nenhuma atividade recente</p>
                  <p className="text-sm mt-1">Comece processando seu primeiro documento!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="text-yellow-800">
              <strong>Atenção:</strong> Alguns dados podem estar usando valores de fallback devido a problemas de conectividade: {error}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}