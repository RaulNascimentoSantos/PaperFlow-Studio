import { useState, useCallback } from 'react'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

interface ProcessingEvent {
  type: string
  stage: string
  progress: number
  message: string
  timestamp: string
}

export default function UploadPage() {
  const { apiKey, apiBaseUrl } = useAppStore()
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [processingEvents, setProcessingEvents] = useState<ProcessingEvent[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile)
    } else {
      alert('Por favor, selecione apenas arquivos PDF')
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (!file || !apiKey) return

    setUploading(true)
    setProcessingEvents([])

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${apiBaseUrl}/v1/documents/upload`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Falha no upload')
      }

      const result = await response.json()
      setDocumentId(result.document_id)
      setUploading(false)
      setIsProcessing(true)

      // Start SSE for processing updates
      startProcessingUpdates(result.document_id)
      
    } catch (error) {
      console.error('Upload error:', error)
      alert('Erro no upload. Verifique sua conexão e API key.')
      setUploading(false)
    }
  }

  const startProcessingUpdates = (docId: string) => {
    // Mock SSE since we can't easily use EventSource with auth headers
    // In real implementation, you'd use the SDK's SSE functionality
    const stages = [
      { stage: 'queued', progress: 0, message: 'Documento na fila de processamento' },
      { stage: 'parsing', progress: 20, message: 'Analisando estrutura do PDF' },
      { stage: 'extracting', progress: 40, message: 'Extraindo texto' },
      { stage: 'tables', progress: 60, message: 'Extraindo tabelas' },
      { stage: 'ocr', progress: 75, message: 'Realizando OCR (se necessário)' },
      { stage: 'embeddings', progress: 90, message: 'Gerando embeddings' },
      { stage: 'completed', progress: 100, message: 'Processamento concluído' }
    ]

    let currentStage = 0
    const interval = setInterval(() => {
      if (currentStage < stages.length) {
        const event: ProcessingEvent = {
          type: currentStage < stages.length - 1 ? 'progress' : 'completed',
          ...stages[currentStage],
          timestamp: new Date().toISOString()
        }
        
        setProcessingEvents(prev => [...prev, event])
        currentStage++

        if (currentStage >= stages.length) {
          setIsProcessing(false)
          clearInterval(interval)
        }
      }
    }, 1500)
  }

  if (!apiKey) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              API Key Necessária
            </CardTitle>
            <CardDescription>
              Configure sua API Key na página inicial antes de fazer uploads.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/">Configurar API Key</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Upload de Documentos</h1>
        <p className="text-muted-foreground">
          Faça upload de PDFs para processamento inteligente
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Selecionar Arquivo</CardTitle>
              <CardDescription>
                Arraste e solte um PDF ou clique para selecionar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                
                {file ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="w-5 h-5" />
                      <span className="font-medium">{file.name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-medium mb-2">
                      Arraste um PDF aqui
                    </p>
                    <p className="text-muted-foreground mb-4">
                      ou clique para selecionar
                    </p>
                  </div>
                )}

                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-input"
                />
                
                {!file && (
                  <Button asChild variant="outline">
                    <label htmlFor="file-input" className="cursor-pointer">
                      Selecionar Arquivo
                    </label>
                  </Button>
                )}
              </div>

              {file && (
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={handleUpload}
                    disabled={uploading || isProcessing}
                    className="flex-1"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Enviar e Processar
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setFile(null)}
                    disabled={uploading || isProcessing}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Processing Status */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Status do Processamento</CardTitle>
              <CardDescription>
                Acompanhe o progresso em tempo real
              </CardDescription>
            </CardHeader>
            <CardContent>
              {processingEvents.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Aguardando upload...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {processingEvents.map((event, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      {event.type === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      ) : (
                        <Loader2 className="w-5 h-5 text-blue-500 mt-0.5 animate-spin" />
                      )}
                      
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium capitalize">
                            {event.stage}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {event.progress}%
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {event.message}
                        </p>
                        <div className="w-full bg-muted rounded-full h-2 mt-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-500"
                            style={{ width: `${event.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {!isProcessing && processingEvents.length > 0 && documentId && (
                    <div className="mt-6 space-y-2">
                      <Button asChild className="w-full">
                        <a href={`/documents/${documentId}`}>
                          Ver Documento Processado
                        </a>
                      </Button>
                      <Button variant="outline" asChild className="w-full">
                        <a href={`/qa/${documentId}`}>
                          Fazer Perguntas (Q&A)
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}