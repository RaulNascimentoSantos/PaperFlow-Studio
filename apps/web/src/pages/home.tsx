import { useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FileText, Zap, Brain, BarChart3 } from 'lucide-react'

export default function HomePage() {
  const { apiKey, setApiKey, apiBaseUrl } = useAppStore()
  const [tempApiKey, setTempApiKey] = useState(apiKey || '')

  const handleSaveApiKey = () => {
    setApiKey(tempApiKey || null)
  }

  const handleTestConnection = async () => {
    if (!tempApiKey) {
      alert('Por favor, insira sua API Key primeiro')
      return
    }

    try {
      const response = await fetch(`${apiBaseUrl}/v1/health`, {
        headers: {
          'x-api-key': tempApiKey,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        setApiKey(tempApiKey)
        alert('✅ Conexão estabelecida com sucesso!')
      } else {
        alert('❌ API Key inválida ou servidor indisponível')
      }
    } catch (error) {
      alert('❌ Erro ao conectar com o servidor')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            PaperFlow Studio
          </h1>
          <p className="text-xl text-slate-300 mb-8">
            Transform Documents into Data Intelligence
          </p>
          
          {/* API Key Configuration */}
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Configuração da API</CardTitle>
                <CardDescription>
                  Configure sua API Key para começar a usar o PaperFlow
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <Input
                    type="password"
                    placeholder="pf_live_xxxxxxxxxxxxxxxx"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sua API Key será armazenada localmente no navegador
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={handleTestConnection} className="flex-1">
                    Testar Conexão
                  </Button>
                  <Button 
                    onClick={handleSaveApiKey} 
                    variant="outline" 
                    className="flex-1"
                  >
                    Salvar
                  </Button>
                </div>
                
                {apiKey && (
                  <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-green-700 dark:text-green-400">
                      ✅ API Key configurada com sucesso
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="text-center">
            <CardHeader>
              <FileText className="w-12 h-12 mx-auto text-blue-500 mb-2" />
              <CardTitle>Upload de PDFs</CardTitle>
              <CardDescription>
                Drag & drop com progresso em tempo real
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Zap className="w-12 h-12 mx-auto text-yellow-500 mb-2" />
              <CardTitle>Processamento IA</CardTitle>
              <CardDescription>
                OCR, extração de tabelas e análise inteligente
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Brain className="w-12 h-12 mx-auto text-purple-500 mb-2" />
              <CardTitle>RAG & Q&A</CardTitle>
              <CardDescription>
                Chat inteligente com seus documentos
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <BarChart3 className="w-12 h-12 mx-auto text-green-500 mb-2" />
              <CardTitle>Analytics</CardTitle>
              <CardDescription>
                Métricas detalhadas de uso e performance
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Quick Actions */}
        {apiKey && (
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-white">Começar Agora</h2>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" asChild>
                <a href="/upload">
                  <FileText className="w-5 h-5 mr-2" />
                  Fazer Upload
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="/documents">
                  Ver Documentos
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="/analytics">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Analytics
                </a>
              </Button>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-slate-300">
              API Server: {apiBaseUrl}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}