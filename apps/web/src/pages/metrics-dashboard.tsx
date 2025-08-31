import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

interface MetricsDashboardData {
  summary: {
    totalDocuments: number;
    activeUsers: number;
    templatesUsed: number;
    apiCalls: number;
  };
  healthScore: {
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
  };
  recentActivity: Array<{
    event_type: string;
    metadata: any;
    recorded_at: string;
    value?: number;
  }>;
  alerts: Array<{
    type: string;
    title: string;
    message: string;
    recommendations?: string[];
  }>;
}

interface MetricsData {
  period: string;
  event_type: string;
  count: number;
  total_value: number;
  avg_value: number;
}

export default function MetricsDashboard() {
  const [dashboardData, setDashboardData] = useState<MetricsDashboardData | null>(null);
  const [metricsData, setMetricsData] = useState<MetricsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<string>('all');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      const tenantId = 'test-tenant-123'; // Mock tenant ID
      const apiKey = 'test-api-key-for-development';

      // Fetch dashboard overview
      const dashboardResponse = await fetch('http://localhost:3002/v1/metrics/dashboard', {
        headers: {
          'x-tenant-id': tenantId,
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      // Fetch metrics data
      const metricsResponse = await fetch('http://localhost:3002/v1/metrics/data?aggregation=day', {
        headers: {
          'x-tenant-id': tenantId,
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!dashboardResponse.ok || !metricsResponse.ok) {
        throw new Error('Failed to fetch metrics data');
      }

      const dashboardResult = await dashboardResponse.json();
      const metricsResult = await metricsResponse.json();

      setDashboardData(dashboardResult);
      setMetricsData(metricsResult.data || []);

    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      
      // Fallback to mock data
      const mockDashboard: MetricsDashboardData = {
        summary: {
          totalDocuments: 45,
          activeUsers: 3,
          templatesUsed: 8,
          apiCalls: 1250
        },
        healthScore: {
          tenantId: 'test-tenant-123',
          score: 78,
          factors: {
            usage: 25,
            engagement: 18,
            billing: 15,
            support: 12,
            integrations: 8
          },
          risk: 'low',
          recommendations: ['Consider upgrading to Pro plan', 'Setup WhatsApp integration'],
          lastUpdated: new Date().toISOString()
        },
        recentActivity: [
          {
            event_type: 'document_processed',
            metadata: { filename: 'contract.pdf' },
            recorded_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            value: 1
          },
          {
            event_type: 'template_executed',
            metadata: { template_name: 'Service Contract' },
            recorded_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            value: 1
          },
          {
            event_type: 'api_call',
            metadata: { endpoint: '/v1/documents/upload' },
            recorded_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            value: 1
          }
        ],
        alerts: [
          {
            type: 'info',
            title: 'Health Score Update',
            message: 'Your account health score is 78/100. Good usage patterns detected.',
            recommendations: ['Consider upgrading to Pro plan', 'Setup WhatsApp integration']
          }
        ]
      };

      const mockMetrics: MetricsData[] = [
        { period: '2024-01-29', event_type: 'document_processed', count: 12, total_value: 12, avg_value: 1 },
        { period: '2024-01-30', event_type: 'document_processed', count: 15, total_value: 15, avg_value: 1 },
        { period: '2024-01-31', event_type: 'document_processed', count: 18, total_value: 18, avg_value: 1 },
        { period: '2024-01-29', event_type: 'template_executed', count: 3, total_value: 3, avg_value: 1 },
        { period: '2024-01-30', event_type: 'template_executed', count: 2, total_value: 2, avg_value: 1 },
        { period: '2024-01-31', event_type: 'template_executed', count: 3, total_value: 3, avg_value: 1 },
      ];

      setDashboardData(mockDashboard);
      setMetricsData(mockMetrics);
    } finally {
      setLoading(false);
    }
  };

  const recordMetricEvent = async (eventType: string, metadata: any = {}, value?: number) => {
    try {
      await fetch('http://localhost:3002/v1/metrics/record', {
        method: 'POST',
        headers: {
          'x-tenant-id': 'test-tenant-123',
          'x-api-key': 'test-api-key-for-development',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventType,
          metadata,
          value
        })
      });
      
      // Refresh dashboard after recording event
      fetchDashboardData();
    } catch (err) {
      console.error('Error recording metric:', err);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'document_processed': return '📄';
      case 'template_executed': return '📋';
      case 'api_call': return '🔗';
      case 'user_login': return '👤';
      case 'integration_used': return '🔌';
      default: return '📊';
    }
  };

  const uniqueEventTypes = Array.from(new Set(metricsData.map(m => m.event_type)));
  const filteredMetrics = selectedEventType === 'all' 
    ? metricsData 
    : metricsData.filter(m => m.event_type === selectedEventType);

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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Metrics Dashboard</h1>
            <p className="text-gray-600 mt-2">Track your usage, engagement, and health score</p>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={() => recordMetricEvent('test_event', { source: 'dashboard' }, 1)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Test Event
            </button>
            <button
              onClick={fetchDashboardData}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Documents Processed</p>
                  <p className="text-3xl font-bold text-gray-900">{dashboardData?.summary.totalDocuments}</p>
                </div>
                <div className="text-blue-600 bg-blue-50 p-3 rounded-full">
                  📄
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Users</p>
                  <p className="text-3xl font-bold text-gray-900">{dashboardData?.summary.activeUsers}</p>
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
                  <p className="text-sm font-medium text-gray-600">Templates Used</p>
                  <p className="text-3xl font-bold text-gray-900">{dashboardData?.summary.templatesUsed}</p>
                </div>
                <div className="text-purple-600 bg-purple-50 p-3 rounded-full">
                  📋
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">API Calls</p>
                  <p className="text-3xl font-bold text-gray-900">{dashboardData?.summary.apiCalls.toLocaleString()}</p>
                </div>
                <div className="text-yellow-600 bg-yellow-50 p-3 rounded-full">
                  🔗
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Health Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>💚</span>
                <span>Account Health Score</span>
              </CardTitle>
              <CardDescription>Overall health of your account based on usage patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-5xl font-bold text-gray-900">{dashboardData?.healthScore.score}</div>
                  <div className="text-sm text-gray-600">out of 100</div>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-2 border ${getRiskColor(dashboardData?.healthScore.risk || 'low')}`}>
                    {dashboardData?.healthScore.risk} risk
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Usage</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${((dashboardData?.healthScore.factors.usage || 0) / 30) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-500">{dashboardData?.healthScore.factors.usage}/30</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Engagement</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full" 
                          style={{ width: `${((dashboardData?.healthScore.factors.engagement || 0) / 25) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-500">{dashboardData?.healthScore.factors.engagement}/25</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Billing</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-yellow-600 h-2 rounded-full" 
                          style={{ width: `${((dashboardData?.healthScore.factors.billing || 0) / 20) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-500">{dashboardData?.healthScore.factors.billing}/20</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Integrations</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full" 
                          style={{ width: `${((dashboardData?.healthScore.factors.integrations || 0) / 10) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-500">{dashboardData?.healthScore.factors.integrations}/10</span>
                    </div>
                  </div>
                </div>

                {dashboardData?.healthScore.recommendations.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm font-medium text-blue-800 mb-2">Recommendations:</div>
                    <ul className="text-sm text-blue-600 space-y-1">
                      {dashboardData.healthScore.recommendations.map((rec, idx) => (
                        <li key={idx}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span>⚡</span>
                <span>Recent Activity</span>
              </CardTitle>
              <CardDescription>Latest events and actions in your account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData?.recentActivity.map((activity, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{getEventTypeIcon(activity.event_type)}</span>
                      <div>
                        <div className="font-medium text-gray-900 capitalize">
                          {activity.event_type.replace('_', ' ')}
                        </div>
                        <div className="text-sm text-gray-500">
                          {activity.metadata?.filename || activity.metadata?.template_name || activity.metadata?.endpoint || 'System event'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {formatDate(activity.recorded_at)}
                      </div>
                    </div>
                  </div>
                ))}
                
                {dashboardData?.recentActivity.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No recent activity recorded
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Metrics Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>📊</span>
              <span>Metrics Timeline</span>
            </CardTitle>
            <CardDescription>Historical view of your usage patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <select
                value={selectedEventType}
                onChange={(e) => setSelectedEventType(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="all">All Events</option>
                {uniqueEventTypes.map(type => (
                  <option key={type} value={type}>{type.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-medium text-gray-600">Period</th>
                    <th className="text-left py-2 px-4 font-medium text-gray-600">Event Type</th>
                    <th className="text-left py-2 px-4 font-medium text-gray-600">Count</th>
                    <th className="text-left py-2 px-4 font-medium text-gray-600">Total Value</th>
                    <th className="text-left py-2 px-4 font-medium text-gray-600">Avg Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMetrics.map((metric, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4">{metric.period}</td>
                      <td className="py-2 px-4">
                        <div className="flex items-center space-x-2">
                          <span>{getEventTypeIcon(metric.event_type)}</span>
                          <span className="capitalize">{metric.event_type.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="py-2 px-4 font-medium">{metric.count}</td>
                      <td className="py-2 px-4">{metric.total_value || 0}</td>
                      <td className="py-2 px-4">{(metric.avg_value || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredMetrics.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No metrics data available for the selected filter
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        {dashboardData?.alerts && dashboardData.alerts.length > 0 && (
          <div className="mt-6 space-y-4">
            {dashboardData.alerts.map((alert, idx) => (
              <Card key={idx} className={`border-l-4 ${
                alert.type === 'warning' ? 'border-yellow-400 bg-yellow-50' : 'border-blue-400 bg-blue-50'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{alert.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      {alert.recommendations && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-gray-700">Recommendations:</div>
                          <ul className="text-xs text-gray-600 mt-1 space-y-1">
                            {alert.recommendations.map((rec, recIdx) => (
                              <li key={recIdx}>• {rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Note</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  Using fallback data due to API connectivity: {error}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}