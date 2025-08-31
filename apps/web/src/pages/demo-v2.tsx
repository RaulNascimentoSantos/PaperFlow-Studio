import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  Shield, 
  Hash, 
  AlertTriangle,
  Calendar,
  Users,
  Gavel,
  Eye,
  EyeOff,
  Download,
  CheckCircle,
  Activity,
  TrendingUp,
  Clock,
  Globe,
  Settings,
  Search,
  Upload,
  BarChart3,
  Zap
} from 'lucide-react';

const DEMO_DATA = {
  document: {
    id: 'doc-demo-123',
    originalName: 'Petição_Inicial_Caso_2025.pdf',
    sha256Hash: '06eb18c137db287ae06d630297843feb540edcc0a8bdc2c8182219541e51e583',
    createdAt: new Date().toISOString(),
    status: 'completed',
    pages: 5,
    sizeBytes: 2547392,
    metadata: {
      caseNumber: '1234567-89.2023.8.26.0100',
      court: 'TJSP - 5ª Vara Cível',
      documentType: 'petition',
      parties: [
        { name: 'José Antonio Silva Santos', role: 'plaintiff', oab: 'OAB/SP 145678' },
        { name: 'Empresa XYZ Ltda', role: 'defendant', cnpj: '12.345.678/0001-90' }
      ]
    }
  },
  piiAnalysis: {
    totalMatches: 12,
    byType: {
      'CPF': 2,
      'CNPJ': 1,
      'OAB': 2,
      'Email': 3,
      'Telefone': 2,
      'CEP': 1,
      'Processo CNJ': 1
    },
    byPage: [
      {
        pageNumber: 1,
        matches: [
          { type: 'CPF', value: '123.456.789-01', start: 145, end: 159, confidence: 0.95 },
          { type: 'OAB', value: 'OAB/SP 145678', start: 98, end: 112, confidence: 0.90 },
          { type: 'Email', value: 'jose.santos@adv.com.br', start: 234, end: 257, confidence: 0.95 }
        ]
      }
    ]
  },
  events: [
    { type: 'progress', stage: 'queued', progress: 0, message: 'Documento na fila', timestamp: new Date(Date.now() - 5000).toISOString() },
    { type: 'progress', stage: 'parsing', progress: 20, message: 'Analisando PDF', timestamp: new Date(Date.now() - 4000).toISOString() },
    { type: 'progress', stage: 'pii_detection', progress: 60, message: 'Detectando dados sensíveis', timestamp: new Date(Date.now() - 3000).toISOString() },
    { type: 'progress', stage: 'bates_applied', progress: 80, message: 'Aplicando numeração Bates', timestamp: new Date(Date.now() - 2000).toISOString() },
    { type: 'complete', stage: 'completed', progress: 100, message: 'Processamento concluído', timestamp: new Date(Date.now() - 1000).toISOString() }
  ],
  metrics: {
    documentsProcessed: 247,
    piiEntitiesDetected: 1854,
    batesOperations: 89,
    webhookDeliveries: 156,
    activeConnections: 3,
    uptime: '2d 14h 32m'
  }
};

export function DemoV2Page() {
  const [activeTab, setActiveTab] = useState('overview');
  const [showRedaction, setShowRedaction] = useState(false);
  const [animatedMetrics, setAnimatedMetrics] = useState(false);

  useEffect(() => {
    // Animate metrics on load
    setTimeout(() => setAnimatedMetrics(true), 500);
  }, []);

  const StatusIndicator = ({ status, label }: { status: 'online' | 'processing' | 'error'; label: string }) => (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${
        status === 'online' ? 'bg-green-500 animate-pulse' :
        status === 'processing' ? 'bg-yellow-500 animate-pulse' :
        'bg-red-500'
      }`} />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );

  const MetricCard = ({ icon: Icon, label, value, trend }: any) => (
    <Card className="bg-gradient-to-br from-background/50 to-background/80 backdrop-blur-sm border-border/50">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold transition-all duration-500 ${
              animatedMetrics ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
            }`}>
              {value}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {trend && (
              <Badge variant="secondary" className="text-xs">
                <TrendingUp className="h-3 w-3 mr-1" />
                {trend}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-4 py-8">
          <div className="flex items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                PaperFlow v2.0
              </h1>
              <p className="text-lg text-muted-foreground">Enterprise Legal Document Processor</p>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-6">
            <StatusIndicator status="online" label="Backend API" />
            <StatusIndicator status="online" label="Database" />
            <StatusIndicator status="online" label="Prometheus" />
            <StatusIndicator status="processing" label="Live Processing" />
          </div>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            icon={FileText} 
            label="Documentos Processados" 
            value={DEMO_DATA.metrics.documentsProcessed}
            trend="+12%"
          />
          <MetricCard 
            icon={Shield} 
            label="PII Detectado" 
            value={DEMO_DATA.metrics.piiEntitiesDetected}
            trend="+8%"
          />
          <MetricCard 
            icon={Hash} 
            label="Operações Bates" 
            value={DEMO_DATA.metrics.batesOperations}
            trend="+15%"
          />
          <MetricCard 
            icon={Globe} 
            label="Webhooks Enviados" 
            value={DEMO_DATA.metrics.webhookDeliveries}
            trend="+22%"
          />
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-background/50 backdrop-blur-sm">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary/20">
              <Activity className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="document" className="data-[state=active]:bg-primary/20">
              <FileText className="h-4 w-4 mr-2" />
              Documento
            </TabsTrigger>
            <TabsTrigger value="pii" className="data-[state=active]:bg-primary/20">
              <Shield className="h-4 w-4 mr-2" />
              PII Detection
            </TabsTrigger>
            <TabsTrigger value="custody" className="data-[state=active]:bg-primary/20">
              <Hash className="h-4 w-4 mr-2" />
              Custódia
            </TabsTrigger>
            <TabsTrigger value="metrics" className="data-[state=active]:bg-primary/20">
              <BarChart3 className="h-4 w-4 mr-2" />
              Métricas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Live Processing Events */}
              <Card className="bg-gradient-to-br from-background/50 to-background/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Processamento em Tempo Real
                  </CardTitle>
                  <CardDescription>
                    Eventos de processamento via Server-Sent Events
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {DEMO_DATA.events.map((event, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
                          {event.type === 'complete' ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : event.type === 'error' ? (
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-primary animate-spin" />
                          )}
                          <div className="flex-1">
                            <div className="font-medium">{event.message}</div>
                            <div className="text-sm text-muted-foreground">
                              Estágio: {event.stage} ({event.progress}%)
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(event.timestamp).toLocaleTimeString('pt-BR')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Legal Document Info */}
              <Card className="bg-gradient-to-br from-background/50 to-background/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gavel className="h-5 w-5 text-blue-500" />
                    Informações Jurídicas
                  </CardTitle>
                  <CardDescription>
                    Dados extraídos automaticamente
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                      <span className="font-medium">Processo CNJ</span>
                      <Badge variant="outline">{DEMO_DATA.document.metadata.caseNumber}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                      <span className="font-medium">Tribunal</span>
                      <Badge variant="outline">{DEMO_DATA.document.metadata.court}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                      <span className="font-medium">Tipo</span>
                      <Badge variant="secondary">Petição Inicial</Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Partes do Processo
                    </h4>
                    {DEMO_DATA.document.metadata.parties.map((party, i) => (
                      <div key={i} className="p-3 rounded-lg bg-background/50 border border-border/50">
                        <div className="font-medium text-sm">{party.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="capitalize">{party.role}</span>
                          {party.oab && <Badge variant="outline" className="text-xs">{party.oab}</Badge>}
                          {party.cnpj && <Badge variant="outline" className="text-xs">{party.cnpj}</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="document" className="space-y-6">
            <Card className="bg-gradient-to-br from-background/50 to-background/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <FileText className="h-6 w-6" />
                      {DEMO_DATA.document.originalName}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Hash className="h-4 w-4" />
                          SHA-256: {DEMO_DATA.document.sha256Hash.substring(0, 12)}...
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(DEMO_DATA.document.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          {DEMO_DATA.document.pages} páginas
                        </span>
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Hash className="h-4 w-4 mr-2" />
                      Aplicar Bates
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Exportar Evidências
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Texto Extraído</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRedaction(!showRedaction)}
                    >
                      {showRedaction ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {showRedaction ? 'Ocultar' : 'Mostrar'} Redações
                    </Button>
                  </div>
                  
                  <ScrollArea className="h-[400px]">
                    <div className="p-4 rounded-lg bg-background/50 font-mono text-sm whitespace-pre-wrap border border-border/50">
{showRedaction ? `=== PETIÇÃO INICIAL - AÇÃO DE INDENIZAÇÃO ===

Exmo. Sr. Dr. Juiz de Direito da 5ª Vara Cível de São Paulo/SP

[CPF: ***REDIGIDO***], brasileiro, casado, advogado, 
inscrito na [OAB: ***REDIGIDO***], [CPF: ***REDIGIDO***], 
[RG: ***REDIGIDO***] SSP/SP, residente e domiciliado na 
Rua das Flores, 123, [CEP: ***REDIGIDO***], São Paulo/SP, 
telefone [Telefone: ***REDIGIDO***], email: [Email: ***REDIGIDO***]

vem, respeitosamente, perante V. Exa., propor a presente

AÇÃO DE INDENIZAÇÃO POR DANOS MORAIS E MATERIAIS

em face de:

EMPRESA XYZ LTDA, pessoa jurídica de direito privado,
[CNPJ: ***REDIGIDO***], estabelecida na Av. Paulista, 1000,
São Paulo/SP, pelos fatos e fundamentos jurídicos que passa a expor:

I - DOS FATOS

Em 15/03/2023, o requerente contratou os serviços da requerida...

[Processo CNJ: ***REDIGIDO***]

Termos em que pede deferimento.

São Paulo, 25 de março de 2023.` : `=== PETIÇÃO INICIAL - AÇÃO DE INDENIZAÇÃO ===

Exmo. Sr. Dr. Juiz de Direito da 5ª Vara Cível de São Paulo/SP

JOSÉ ANTONIO SILVA SANTOS, brasileiro, casado, advogado, 
inscrito na OAB/SP 145678, CPF: 123.456.789-01, 
RG: 12.345.678-9 SSP/SP, residente e domiciliado na 
Rua das Flores, 123, CEP: 01310-100, São Paulo/SP, 
telefone (11) 98765-4321, email: jose.santos@adv.com.br

vem, respeitosamente, perante V. Exa., propor a presente

AÇÃO DE INDENIZAÇÃO POR DANOS MORAIS E MATERIAIS

em face de:

EMPRESA XYZ LTDA, pessoa jurídica de direito privado,
CNPJ: 12.345.678/0001-90, estabelecida na Av. Paulista, 1000,
São Paulo/SP, pelos fatos e fundamentos jurídicos que passa a expor:

I - DOS FATOS

Em 15/03/2023, o requerente contratou os serviços da requerida...

Processo CNJ: 1234567-89.2023.8.26.0100

Termos em que pede deferimento.

São Paulo, 25 de março de 2023.`}
                    </div>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pii" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-background/50 to-background/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Dados Sensíveis Detectados
                  </CardTitle>
                  <CardDescription>
                    Detecção automática com padrões brasileiros (LGPD/GDPR)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Alert>
                      <Shield className="h-4 w-4" />
                      <AlertDescription>
                        {DEMO_DATA.piiAnalysis.totalMatches} dados sensíveis detectados em {DEMO_DATA.document.pages} páginas
                      </AlertDescription>
                    </Alert>
                    
                    <div className="space-y-2">
                      {Object.entries(DEMO_DATA.piiAnalysis.byType).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                          <span className="font-medium">{type}</span>
                          <Badge variant="destructive">{count} ocorrência{count !== 1 ? 's' : ''}</Badge>
                        </div>
                      ))}
                    </div>
                    
                    <Button className="w-full" variant="destructive">
                      <Shield className="h-4 w-4 mr-2" />
                      Aplicar Redação Automática
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-background/50 to-background/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Hash className="h-5 w-5 text-blue-500" />
                    Numeração Bates
                  </CardTitle>
                  <CardDescription>
                    Padrão legal para documentos de processo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Prefixo</label>
                      <div className="p-2 rounded bg-background/50 border">CASE-2025-</div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Número Inicial</label>
                      <div className="p-2 rounded bg-background/50 border">000001</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preview da Numeração</label>
                    <div className="space-y-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded bg-background/50 border border-border/50">
                          <span className="text-sm">Página {i + 1}</span>
                          <Badge variant="outline">CASE-2025-{String(i + 1).padStart(6, '0')}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <Button className="w-full">
                    <Hash className="h-4 w-4 mr-2" />
                    Aplicar Numeração Bates
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="custody" className="space-y-6">
            <Card className="bg-gradient-to-br from-background/50 to-background/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-500" />
                  Cadeia de Custódia Criptográfica
                </CardTitle>
                <CardDescription>
                  Verificação de integridade com SHA-256
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Manifest de evidência gerado em {new Date().toLocaleString('pt-BR')}
                    <br />
                    <code className="text-xs mt-1 block">Hash: {DEMO_DATA.document.sha256Hash.substring(0, 32)}...</code>
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-3">
                  <h4 className="font-medium">Cadeia de Eventos Auditáveis:</h4>
                  
                  {[
                    { action: 'document_uploaded', actor: 'user', timestamp: '2025-08-31T05:00:00Z' },
                    { action: 'text_extracted', actor: 'system', timestamp: '2025-08-31T05:00:15Z' },
                    { action: 'pii_detected', actor: 'system', timestamp: '2025-08-31T05:00:45Z' },
                    { action: 'bates_applied', actor: 'user', timestamp: '2025-08-31T05:01:20Z' },
                    { action: 'custody_verified', actor: 'system', timestamp: '2025-08-31T05:01:35Z' }
                  ].map((event, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{event.action.replace('_', ' ').toUpperCase()}</div>
                        <div className="text-xs text-muted-foreground">Por: {event.actor}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleTimeString('pt-BR')}
                      </div>
                    </div>
                  ))}
                </div>
                
                <Button className="w-full" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Manifest Completo
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-background/50 to-background/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-500" />
                    Sistema em Tempo Real
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-green-500">{DEMO_DATA.metrics.activeConnections}</div>
                      <div className="text-sm text-muted-foreground">Conexões SSE</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-blue-500">{DEMO_DATA.metrics.uptime}</div>
                      <div className="text-sm text-muted-foreground">Uptime</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">CPU Usage</span>
                      <span className="text-sm">23%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full w-[23%] transition-all duration-500" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Memory Usage</span>
                      <span className="text-sm">456 MB</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-yellow-500 h-2 rounded-full w-[45%] transition-all duration-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-background/50 to-background/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-purple-500" />
                    Webhooks HMAC
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                      <span className="text-sm">URL Configurada</span>
                      <Badge variant="outline">1</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                      <span className="text-sm">Entregas Hoje</span>
                      <Badge variant="secondary">{DEMO_DATA.metrics.webhookDeliveries}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                      <span className="text-sm">Taxa de Sucesso</span>
                      <Badge variant="default" className="bg-green-500">99.2%</Badge>
                    </div>
                  </div>
                  
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Último webhook enviado há 2 minutos
                      <br />
                      <code className="text-xs">Evento: document.pii_detected</code>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer com informações técnicas */}
        <Card className="bg-gradient-to-r from-background/30 to-background/60 backdrop-blur-sm border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>PaperFlow v2.0 Enterprise</span>
                <span>•</span>
                <span>Backend: TypeScript + Fastify</span>
                <span>•</span>
                <span>Frontend: React + Vite</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                <span>Todos os sistemas operacionais</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}