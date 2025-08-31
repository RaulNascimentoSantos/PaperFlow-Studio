const FormData = require('form-data');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

async function testDirectUpload() {
    console.log('🚀 Testando upload direto de documentos...\n');
    
    // Criar um arquivo PDF de teste
    const testPDF = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 200
>>
stream
BT
/F1 12 Tf
100 700 Td
(PaperFlow Test Document - Upload Direct Test) Tj
100 680 Td
(Este é um documento de teste para validar o upload.) Tj
100 660 Td
(Data: ${new Date().toISOString()}) Tj
100 640 Td
(Status: Teste de funcionalidade) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000125 00000 n 
0000000221 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
500
%%EOF`;

    const testFilePath = path.join(__dirname, 'test-upload-document.pdf');
    fs.writeFileSync(testFilePath, testPDF);
    console.log(`✅ Arquivo PDF de teste criado: ${testFilePath}`);
    
    // Configurações da API
    const API_BASE = 'http://localhost:3002/v1';
    const API_KEY = 'test-api-key-development-v3';
    const TENANT_ID = 'test-tenant-complete-v3';
    
    console.log(`🔧 Configurações:`);
    console.log(`   - Base URL: ${API_BASE}`);
    console.log(`   - API Key: ${API_KEY}`);
    console.log(`   - Tenant ID: ${TENANT_ID}\n`);
    
    try {
        // Testar conexão primeiro
        console.log('🔍 1. Testando conexão com a API...');
        const testResponse = await fetch(`${API_BASE}/templates`, {
            headers: {
                'X-API-Key': API_KEY,
                'X-Tenant-ID': TENANT_ID
            }
        });
        
        if (testResponse.ok) {
            const testData = await testResponse.json();
            console.log(`✅ Conexão OK! Templates: ${testData.templates?.length || 0}`);
        } else {
            console.log(`❌ Erro de conexão: ${testResponse.status} - ${testResponse.statusText}`);
            const errorText = await testResponse.text();
            console.log(`   Detalhes: ${errorText}`);
        }
        
        console.log('\n📤 2. Testando upload de documento...');
        
        // Preparar FormData
        const form = new FormData();
        form.append('file', fs.createReadStream(testFilePath), {
            filename: 'test-document.pdf',
            contentType: 'application/pdf'
        });
        
        console.log(`   - Arquivo: test-document.pdf`);
        console.log(`   - Tamanho: ${fs.statSync(testFilePath).size} bytes`);
        console.log(`   - Content-Type: application/pdf`);
        
        // Fazer upload
        const uploadResponse = await fetch(`${API_BASE}/documents/upload`, {
            method: 'POST',
            headers: {
                'X-API-Key': API_KEY,
                'X-Tenant-ID': TENANT_ID,
                ...form.getHeaders()
            },
            body: form
        });
        
        console.log(`\n📊 Resposta do Upload:`);
        console.log(`   - Status: ${uploadResponse.status} ${uploadResponse.statusText}`);
        console.log(`   - Headers:`, Object.fromEntries(uploadResponse.headers.entries()));
        
        if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            console.log(`✅ Upload bem-sucedido!`);
            console.log(`   - Document ID: ${uploadResult.document_id}`);
            console.log(`   - Status: ${uploadResult.status}`);
            
            // Testar listagem de documentos
            console.log('\n📋 3. Testando listagem de documentos...');
            const listResponse = await fetch(`${API_BASE}/documents`, {
                headers: {
                    'X-API-Key': API_KEY,
                    'X-Tenant-ID': TENANT_ID
                }
            });
            
            if (listResponse.ok) {
                const listData = await listResponse.json();
                console.log(`✅ Documentos encontrados: ${listData.total}`);
                
                if (listData.documents && listData.documents.length > 0) {
                    console.log('\n📄 Documentos na lista:');
                    listData.documents.forEach((doc, index) => {
                        console.log(`   ${index + 1}. ${doc.original_name} (ID: ${doc.id}, Status: ${doc.status})`);
                    });
                }
            } else {
                console.log(`❌ Erro ao listar documentos: ${listResponse.status}`);
            }
            
            // Testar extração de dados
            console.log('\n🔍 4. Testando extração de dados...');
            const extractResponse = await fetch(`${API_BASE}/documents/${uploadResult.document_id}/extract`, {
                headers: {
                    'X-API-Key': API_KEY,
                    'X-Tenant-ID': TENANT_ID
                }
            });
            
            if (extractResponse.ok) {
                const extractData = await extractResponse.json();
                console.log(`✅ Dados extraídos:`);
                console.log(`   - Páginas: ${extractData.pages}`);
                console.log(`   - Texto: ${extractData.text.length} caracteres`);
                console.log(`   - Tabelas: ${extractData.tables.length}`);
                console.log(`   - Tempo de processamento: ${extractData.processing_time_ms}ms`);
            } else {
                console.log(`❌ Erro na extração: ${extractResponse.status}`);
            }
            
        } else {
            const errorText = await uploadResponse.text();
            console.log(`❌ Falha no upload:`);
            console.log(`   - Erro: ${errorText}`);
        }
        
    } catch (error) {
        console.error(`❌ Erro geral: ${error.message}`);
        console.error(error.stack);
    } finally {
        // Limpar arquivo de teste
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
            console.log(`\n🧹 Arquivo de teste removido: ${testFilePath}`);
        }
    }
    
    console.log('\n✅ Teste completo!');
}

// Executar teste
testDirectUpload().catch(console.error);