import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/app-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { FileText, Clock, Check, AlertCircle, Eye, Database, Activity, RefreshCw } from 'lucide-react';

interface Document {
  id: string;
  original_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  size_bytes: number;
  pages: number;
  created_at: string;
  processed_at: string;
}

interface DocumentData {
  document_id: string;
  pages: number;
  text: string;
  tables: Array<{
    name: string;
    rows: string[][];
  }>;
  metadata: Record<string, any>;
  processing_time_ms: number;
}

export function DocumentsPage() {
  const { apiKey, apiBaseUrl } = useAppStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [docData, setDocData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    if (apiKey) {
      fetchDocuments();
    }
  }, [apiKey]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/v1/documents/`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      } else {
        console.error('Erro na API:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentData = async (docId: string) => {
    try {
      setExtracting(true);
      const response = await fetch(`${apiBaseUrl}/v1/documents/${docId}/extract`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDocData(data);
      } else {
        console.error('Erro na API extract:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Erro ao extrair dados:', error);
    } finally {
      setExtracting(false);
    }
  };

  const handleViewDocument = (doc: Document) => {
    setSelectedDoc(doc);
    setDocData(null);
    fetchDocumentData(doc.id);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4 text-green-600" />;
      case 'processing':
        return <Activity className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (!apiKey) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você precisa configurar uma API key válida para acessar esta página.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Documentos</h1>
        <p className="text-muted-foreground">
          Gerencie e visualize seus documentos processados com IA
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de Documentos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Meus Documentos
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={fetchDocuments}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
            <CardDescription>
              {documents.length} documento(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p>Carregando documentos...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum documento encontrado</p>
                <p className="text-sm">Faça upload de um PDF para começar</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {documents.map((doc) => (
                    <Card
                      key={doc.id}
                      className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedDoc?.id === doc.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => handleViewDocument(doc)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm mb-2 truncate">
                              {doc.original_name}
                            </h4>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{formatFileSize(doc.size_bytes)}</span>
                              <span>{doc.pages} páginas</span>
                              <span>{formatDate(doc.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(doc.status)}>
                              <span className="flex items-center gap-1">
                                {getStatusIcon(doc.status)}
                                {doc.status}
                              </span>
                            </Badge>
                            <Button size="sm" variant="ghost">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Visualização de Dados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Dados Extraídos
            </CardTitle>
            <CardDescription>
              {selectedDoc ? `Visualizando: ${selectedDoc.original_name}` : 'Selecione um documento para ver os dados'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedDoc ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Selecione um documento da lista</p>
              </div>
            ) : extracting ? (
              <div className="text-center py-8">
                <Activity className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p>Extraindo dados do documento...</p>
              </div>
            ) : docData ? (
              <Tabs defaultValue="text" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="text">Texto</TabsTrigger>
                  <TabsTrigger value="tables">Tabelas</TabsTrigger>
                  <TabsTrigger value="metadata">Metadados</TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="mt-4">
                  <ScrollArea className="h-[350px]">
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-xs font-mono bg-muted p-4 rounded-lg">
                        {docData.text || 'Nenhum texto extraído'}
                      </pre>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="tables" className="mt-4">
                  <ScrollArea className="h-[350px]">
                    {docData.tables && docData.tables.length > 0 ? (
                      <div className="space-y-4">
                        {docData.tables.map((table, index) => (
                          <div key={index}>
                            <h4 className="font-medium mb-2">{table.name}</h4>
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full text-xs">
                                <tbody>
                                  {table.rows.map((row, rowIndex) => (
                                    <tr key={rowIndex} className={rowIndex === 0 ? 'bg-muted font-medium' : ''}>
                                      {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} className="border-r border-b p-2 last:border-r-0">
                                          {cell}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        Nenhuma tabela encontrada neste documento
                      </p>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="metadata" className="mt-4">
                  <ScrollArea className="h-[350px]">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Páginas:</span>
                          <p className="text-muted-foreground">{docData.pages}</p>
                        </div>
                        <div>
                          <span className="font-medium">Tempo de Processamento:</span>
                          <p className="text-muted-foreground">{docData.processing_time_ms}ms</p>
                        </div>
                      </div>
                      <Separator />
                      <div className="text-xs">
                        <h4 className="font-medium mb-2">Metadados Completos:</h4>
                        <pre className="bg-muted p-3 rounded-lg overflow-auto">
                          {JSON.stringify(docData.metadata, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Erro ao carregar dados do documento</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DocumentsPage;