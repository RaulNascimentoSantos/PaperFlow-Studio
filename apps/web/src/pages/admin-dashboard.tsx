import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

interface AAARRRMetrics {
  acquisition: {
    newTenants: number;
    signupRate: number;
    activationRate: number;
    sources: Record<string, number>;
  };
  activation: {
    onboardingCompleted: number;
    firstDocumentProcessed: number;
    timeToFirstValue: number;
  };
  retention: {
    daily: number;
    weekly: number;
    monthly: number;
    churnRate: number;
  };
  revenue: {
    mrr: number;
    arr: number;
    arpu: number;
    ltv: number;
  };
  referral: {
    referralRate: number;
    viralCoefficient: number;
    referralConversions: number;
  };
}

interface HealthScore {
  tenantId: string;
  score: number;
  factors: {
    usage: number;
    engagement: number;
    billing: number;
    support: number;
    integrations: number;
  };
  risk: 'low' | 'medium' | 'high';
  recommendations: string[];
  lastUpdated: string;
}

interface AdminDashboardData {
  aaarrr: AAARRRMetrics;
  healthScores: {
    healthScores: Array<HealthScore & { tenant_name: string; plan: string }>;
    total: number;
    summary: {
      averageScore: number;
      riskDistribution: { low: number; medium: number; high: number };
    };
  };
  systemMetrics: {
    totalTenants: number;
    activeUsers: number;
    documentsProcessed: number;
    systemHealth: string;
  };
}

export default function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');

  useEffect(() => {
    fetchDashboardData();
  }, [selectedPeriod]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Mock API calls for admin dashboard
      const responses = await Promise.all([
        // AARRR metrics
        fetch(`http://localhost:3002/v1/metrics/aarrr?period=${selectedPeriod}`, {
          headers: {
            'x-tenant-id': 'admin-tenant',
            'x-api-key': 'admin-api-key'
          }
        }),
        // Health scores for all tenants
        fetch('http://localhost:3002/v1/metrics/admin/health-scores', {
          headers: {
            'x-tenant-id': 'admin-tenant',
            'x-api-key': 'admin-api-key'
          }
        }),
        // System health
        fetch('http://localhost:3002/v1/health')
      ]);

      if (responses.some(r => !r.ok)) {
        throw new Error('Failed to fetch dashboard data');
      }

      const [aaarrr, healthScores, systemHealth] = await Promise.all(
        responses.map(r => r.json())
      );

      // Mock system metrics
      const systemMetrics = {
        totalTenants: healthScores.total || 6,
        activeUsers: 24,
        documentsProcessed: 1250,
        systemHealth: systemHealth.status === 'healthy' ? 'All Systems Operational' : 'Issues Detected'
      };

      setData({
        aaarrr,
        healthScores,
        systemMetrics
      });

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      
      // Fallback to mock data
      setData({
        aaarrr: {
          acquisition: { newTenants: 5, signupRate: 75, activationRate: 80, sources: {} },
          activation: { onboardingCompleted: 6, firstDocumentProcessed: 4, timeToFirstValue: 24.5 },
          retention: { daily: 25, weekly: 18, monthly: 12, churnRate: 20 },
          revenue: { mrr: 2500, arr: 30000, arpu: 312.5, ltv: 1500 },
          referral: { referralRate: 33.3, viralCoefficient: 0.8, referralConversions: 4 }
        },
        healthScores: {
          healthScores: [
            {
              tenantId: '1', score: 85, risk: 'low' as const, tenant_name: 'Empresa ABC', plan: 'pro',
              factors: { usage: 25, engagement: 20, billing: 18, support: 12, integrations: 10 },
              recommendations: [], lastUpdated: new Date().toISOString()
            },
            {
              tenantId: '2', score: 45, risk: 'high' as const, tenant_name: 'Startup XYZ', plan: 'free',
              factors: { usage: 12, engagement: 8, billing: 5, support: 10, integrations: 10 },
              recommendations: ['Increase document processing', 'Consider plan upgrade'], lastUpdated: new Date().toISOString()
            }
          ],
          total: 6,
          summary: { averageScore: 72, riskDistribution: { low: 3, medium: 2, high: 1 } }
        },
        systemMetrics: {
          totalTenants: 6,
          activeUsers: 24,
          documentsProcessed: 1250,
          systemHealth: 'All Systems Operational'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
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
            <CardContent className="p-6">
              <div className="text-center">
                <div className="text-red-600 text-xl font-semibold mb-2">Error Loading Dashboard</div>
                <div className="text-gray-600 mb-4">{error}</div>
                <button
                  onClick={fetchDashboardData}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">PaperFlow Admin Dashboard</h1>
            <p className="text-gray-600 mt-2">Complete observability and product metrics</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="1d">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">{data?.systemMetrics.systemHealth}</span>
            </div>
          </div>
        </div>

        {/* System Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tenants</p>
                  <p className="text-3xl font-bold text-gray-900">{data?.systemMetrics.totalTenants}</p>
                </div>
                <div className="text-blue-600 bg-blue-50 p-3 rounded-full">
                  🏢
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Users</p>
                  <p className="text-3xl font-bold text-gray-900">{data?.systemMetrics.activeUsers}</p>
                </div>
                <div className="text-green-600 bg-green-50 p-3 rounded-full">
                  👥
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Documents Processed</p>
                  <p className="text-3xl font-bold text-gray-900">{data?.systemMetrics.documentsProcessed.toLocaleString()}</p>
                </div>
                <div className="text-purple-600 bg-purple-50 p-3 rounded-full">
                  📄
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                  <p className="text-3xl font-bold text-gray-900">{formatCurrency(data?.aaarrr.revenue.mrr || 0)}</p>
                </div>
                <div className="text-yellow-600 bg-yellow-50 p-3 rounded-full">
                  💰
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AARRR Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>📈</span>
                <span>AARRR Metrics</span>
              </CardTitle>
              <CardDescription>Acquisition, Activation, Retention, Revenue, Referral</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{data?.aaarrr.acquisition.newTenants}</div>
                    <div className="text-sm text-blue-600">New Tenants</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{data?.aaarrr.acquisition.activationRate.toFixed(1)}%</div>
                    <div className="text-sm text-green-600">Activation Rate</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{data?.aaarrr.retention.monthly}</div>
                    <div className="text-sm text-purple-600">Monthly Retention</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{data?.aaarrr.retention.churnRate.toFixed(1)}%</div>
                    <div className="text-sm text-red-600">Churn Rate</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{formatCurrency(data?.aaarrr.revenue.arpu || 0)}</div>
                    <div className="text-sm text-yellow-600">ARPU</div>
                  </div>
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <div className="text-2xl font-bold text-indigo-600">{data?.aaarrr.referral.referralConversions}</div>
                    <div className="text-sm text-indigo-600">Referral Conversions</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>💚</span>
                <span>Health Score Distribution</span>
              </CardTitle>
              <CardDescription>Tenant risk assessment overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{data?.healthScores.summary.averageScore}</div>
                  <div className="text-sm text-gray-600">Average Health Score</div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="font-medium text-green-800">Low Risk</span>
                    </div>
                    <span className="text-green-600 font-bold">{data?.healthScores.summary.riskDistribution.low}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span className="font-medium text-yellow-800">Medium Risk</span>
                    </div>
                    <span className="text-yellow-600 font-bold">{data?.healthScores.summary.riskDistribution.medium}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="font-medium text-red-800">High Risk</span>
                    </div>
                    <span className="text-red-600 font-bold">{data?.healthScores.summary.riskDistribution.high}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tenant Health Scores Detail */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>🎯</span>
              <span>Tenant Health Scores</span>
            </CardTitle>
            <CardDescription>Detailed view of tenant health and engagement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Tenant</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Plan</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Score</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Risk</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Usage</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Engagement</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Recommendations</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.healthScores.healthScores.map((tenant) => (
                    <tr key={tenant.tenantId} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900">{tenant.tenant_name}</div>
                          <div className="text-sm text-gray-500">{tenant.tenantId.slice(0, 8)}...</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                          {tenant.plan}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="text-lg font-bold">{tenant.score}</div>
                          <div className="text-sm text-gray-500">/100</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getRiskColor(tenant.risk)}`}>
                          {tenant.risk}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${(tenant.factors.usage / 30) * 100}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{tenant.factors.usage}/30</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${(tenant.factors.engagement / 25) * 100}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{tenant.factors.engagement}/25</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {tenant.recommendations.slice(0, 2).map((rec, idx) => (
                            <div key={idx} className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                              {rec}
                            </div>
                          ))}
                          {tenant.recommendations.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{tenant.recommendations.length - 2} more
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Warning</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  Some data may be using fallback values due to API connectivity issues: {error}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}