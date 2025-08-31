# 🧪 PaperFlow API - Guia de Teste

O servidor está rodando em: **http://localhost:3000**

## 📋 Endpoints Básicos Disponíveis

### 1. Health Check
```bash
curl http://localhost:3000/health
```
**Resposta esperada:**
```json
{
  "status": "ok",
  "message": "PaperFlow API Test Server Running"
}
```

### 2. Informações da API
```bash
curl http://localhost:3000/
```
**Resposta esperada:**
```json
{
  "name": "PaperFlow API Test",
  "version": "1.0.0-mvp",
  "message": "API is running in development mode with mock services",
  "endpoints": {
    "health": "/health",
    "docs": "/docs (when full app is running)"
  }
}
```

## 🔧 Testando com diferentes ferramentas

### Usando curl (linha de comando)
```bash
# Health check
curl http://localhost:3000/health

# API info
curl http://localhost:3000/

# Com headers formatados
curl -H "Content-Type: application/json" http://localhost:3000/health
```

### Usando PowerShell (Windows)
```powershell
# Health check
Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get

# API info
Invoke-RestMethod -Uri "http://localhost:3000/" -Method Get
```

### Usando seu navegador
Abra no navegador:
- http://localhost:3000/
- http://localhost:3000/health

## 📊 Status dos Serviços Mock

✅ **Database**: Mock ativo com usuário de teste  
✅ **Redis**: Mock ativo para cache  
✅ **Storage**: Local file system  
✅ **Queue**: Mock para processamento de documentos  
✅ **AI Services**: Mock responses em português  

## 🧪 Usuário de Teste Criado

O sistema já tem um usuário de teste:
- **Email**: test@paperflow.dev
- **Plano**: pro
- **Créditos**: 5000
- **API Key**: será gerada quando implementarmos autenticação

## 🎯 O que testar agora:

1. **Conectividade básica**: Teste os endpoints acima
2. **Resposta JSON**: Verifique se retorna JSON válido
3. **Performance**: Veja a velocidade de resposta
4. **Logs**: Observe o console onde o servidor está rodando

## 📝 Reportar Problemas

Se encontrar algum erro, reporte:
- URL que testou
- Método HTTP usado
- Resposta recebida
- Erro mostrado no console do servidor

---

**Status**: ✅ Servidor rodando e pronto para testes!
**Próximo passo**: Após testar, podemos implementar o servidor completo com todas as rotas da API PaperFlow.