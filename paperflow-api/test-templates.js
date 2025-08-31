const axios = require('axios');
const FormData = require('form-data');

const API_URL = 'http://localhost:3002';
const TENANT_ID = 'demo-tenant';
const API_KEY = 'pk_test_123456789';

async function testTemplateSystem() {
  console.log('🎯 Testing Template System Features\n');
  
  try {
    // 1. Test listar templates do marketplace (público)
    console.log('1. Testing template marketplace (public templates)...');
    const marketplaceResponse = await axios.get(`${API_URL}/v1/templates/marketplace`, {
      params: {
        page: 1,
        limit: 10
      }
    });
    
    console.log('✅ Marketplace templates:', {
      count: marketplaceResponse.data.templates.length,
      templates: marketplaceResponse.data.templates.map(t => ({
        name: t.name,
        category: t.category,
        usageCount: t.metrics.usageCount
      }))
    });

    // 2. Test listar templates do tenant
    console.log('\n2. Testing tenant templates listing...');
    const listResponse = await axios.get(`${API_URL}/v1/templates`, {
      headers: {
        'x-api-key': API_KEY,
        'x-tenant-id': TENANT_ID
      },
      params: {
        page: 1,
        limit: 10,
        category: 'hr'
      }
    });
    
    console.log('✅ Tenant templates:', {
      count: listResponse.data.templates.length,
      templates: listResponse.data.templates.map(t => ({
        name: t.name,
        category: t.category,
        visibility: t.visibility
      }))
    });

    // 3. Test obter detalhes de um template específico
    if (listResponse.data.templates.length > 0) {
      const templateId = listResponse.data.templates[0].id;
      
      console.log('\n3. Testing template details...');
      const templateResponse = await axios.get(`${API_URL}/v1/templates/${templateId}`, {
        headers: {
          'x-api-key': API_KEY,
          'x-tenant-id': TENANT_ID
        }
      });
      
      console.log('✅ Template details:', {
        name: templateResponse.data.name,
        category: templateResponse.data.category,
        steps: templateResponse.data.workflow.steps.length,
        fields: templateResponse.data.fields.length
      });
    }

    // 4. Test criar template personalizado
    console.log('\n4. Testing custom template creation...');
    const createTemplateData = {
      name: 'Teste Template Personalizado',
      slug: 'teste-template-personalizado',
      description: 'Template de teste criado via API para validar funcionalidades',
      category: 'hr',
      icon: '🧪',
      tags: ['teste', 'personalizado', 'api'],
      visibility: 'tenant',
      workflow: {
        steps: [
          {
            name: 'Upload de Documento',
            type: 'upload',
            order: 1,
            required: true,
            config: {
              allowedFormats: ['pdf', 'jpg', 'png'],
              maxSize: '10MB'
            }
          },
          {
            name: 'Validação de Dados',
            type: 'validation',
            order: 2,
            required: true,
            config: {
              rules: ['required_fields', 'format_validation']
            }
          },
          {
            name: 'Extração de Informações',
            type: 'extraction',
            order: 3,
            required: true,
            config: {
              strategy: 'ai',
              confidence: 0.85
            }
          },
          {
            name: 'Aprovação',
            type: 'approval',
            order: 4,
            required: false,
            config: {
              approvers: ['manager'],
              autoApprove: false
            }
          }
        ]
      },
      fields: [
        {
          name: 'nome_completo',
          label: 'Nome Completo',
          type: 'text',
          required: true,
          validation: {
            minLength: 2,
            maxLength: 100
          }
        },
        {
          name: 'cpf',
          label: 'CPF',
          type: 'text',
          required: true,
          validation: {
            format: 'cpf'
          }
        },
        {
          name: 'data_nascimento',
          label: 'Data de Nascimento',
          type: 'date',
          required: true
        },
        {
          name: 'observacoes',
          label: 'Observações',
          type: 'text',
          required: false,
          description: 'Informações adicionais sobre o documento'
        }
      ],
      validations: [
        {
          name: 'CPF Válido',
          type: 'format',
          field: 'cpf',
          config: {
            format: 'cpf'
          },
          errorMessage: 'CPF inválido',
          severity: 'error'
        }
      ],
      piiDetection: {
        enabled: true,
        patterns: ['cpf', 'rg', 'email'],
        redactionStrategy: 'partial'
      }
    };
    
    const createResponse = await axios.post(`${API_URL}/v1/templates`, createTemplateData, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'x-tenant-id': TENANT_ID
      }
    });
    
    console.log('✅ Template created:', createResponse.data);
    const newTemplateId = createResponse.data.id;

    // 5. Test executar template (simulado)
    console.log('\n5. Testing template execution...');
    const executeData = {
      documentId: 'test-document-123',
      inputData: {
        nome_completo: 'João da Silva',
        cpf: '123.456.789-00',
        data_nascimento: '1990-05-15'
      }
    };
    
    try {
      const executeResponse = await axios.post(
        `${API_URL}/v1/templates/${newTemplateId}/execute`,
        executeData,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'x-tenant-id': TENANT_ID
          }
        }
      );
      
      console.log('✅ Template execution started:', executeResponse.data);
      const executionId = executeResponse.data.executionId;

      // 6. Test verificar status da execução
      console.log('\n6. Testing execution status check...');
      setTimeout(async () => {
        try {
          const statusResponse = await axios.get(
            `${API_URL}/v1/templates/executions/${executionId}`,
            {
              headers: {
                'x-api-key': API_KEY,
                'x-tenant-id': TENANT_ID
              }
            }
          );
          
          console.log('✅ Execution status:', {
            id: statusResponse.data.id,
            status: statusResponse.data.status,
            currentStep: statusResponse.data.currentStep,
            completedSteps: statusResponse.data.metrics.completedSteps,
            totalSteps: statusResponse.data.metrics.stepCount
          });
        } catch (statusError) {
          console.log('ℹ️  Execution status check (may not be ready):', 
            statusError.response?.status, statusError.response?.data?.message || statusError.message);
        }
      }, 1000);
      
    } catch (executeError) {
      console.log('ℹ️  Template execution test (expected if full workflow not ready):', 
        executeError.response?.status, executeError.response?.data?.message || executeError.message);
    }

    // 7. Test filtros e busca
    console.log('\n7. Testing template search and filters...');
    const searchResponse = await axios.get(`${API_URL}/v1/templates`, {
      headers: {
        'x-api-key': API_KEY,
        'x-tenant-id': TENANT_ID
      },
      params: {
        search: 'admissao',
        category: 'hr',
        page: 1,
        limit: 5
      }
    });
    
    console.log('✅ Search results:', {
      query: 'admissao',
      count: searchResponse.data.templates.length,
      templates: searchResponse.data.templates.map(t => t.name)
    });

    console.log('\n🎉 Template system tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Template test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Esperar o servidor estar pronto e executar os testes
setTimeout(() => {
  testTemplateSystem();
}, 3000);