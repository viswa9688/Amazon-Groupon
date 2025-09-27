import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { performanceMonitor } from '@/lib/performance';
import { RefreshCw, Zap, Database, Clock, TrendingUp } from 'lucide-react';

interface PerformanceDashboardProps {
  className?: string;
}

export default function PerformanceDashboard({ className }: PerformanceDashboardProps) {
  const [summary, setSummary] = useState(performanceMonitor.getSummary());
  const [recentMetrics, setRecentMetrics] = useState(performanceMonitor.getRecentMetrics(5));

  const refreshMetrics = () => {
    setSummary(performanceMonitor.getSummary());
    setRecentMetrics(performanceMonitor.getRecentMetrics(5));
  };

  useEffect(() => {
    // Refresh metrics every 5 seconds
    const interval = setInterval(refreshMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const getPerformanceColor = (responseTime: number) => {
    if (responseTime < 200) return 'text-green-600';
    if (responseTime < 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceBadge = (responseTime: number) => {
    if (responseTime < 200) return 'bg-green-100 text-green-800';
    if (responseTime < 500) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6 text-blue-600" />
          Performance Dashboard
        </h2>
        <Button onClick={refreshMetrics} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalCalls}</div>
            <p className="text-xs text-muted-foreground">
              Since page load
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(summary.avgResponseTime)}`}>
              {summary.avgResponseTime}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Across all endpoints
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {summary.cacheHitRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              Cached responses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent API Calls */}
      <Card>
        <CardHeader>
          <CardTitle>Recent API Calls</CardTitle>
        </CardHeader>
        <CardContent>
          {recentMetrics.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No API calls recorded yet
            </p>
          ) : (
            <div className="space-y-3">
              {recentMetrics.map((metric, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm">{metric.endpoint}</span>
                      {metric.cacheHit && (
                        <Badge variant="secondary" className="text-xs">
                          Cached
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getPerformanceBadge(metric.apiResponseTime)}>
                      {Math.round(metric.apiResponseTime)}ms
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(metric.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Endpoints */}
      {summary.endpoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monitored Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.endpoints.map((endpoint, index) => (
                <Badge key={index} variant="outline" className="font-mono text-xs">
                  {endpoint}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-start space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
            <p className="text-sm text-muted-foreground">
              <strong>Green (&lt;200ms):</strong> Excellent performance
            </p>
          </div>
          <div className="flex items-start space-x-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
            <p className="text-sm text-muted-foreground">
              <strong>Yellow (200-500ms):</strong> Good performance
            </p>
          </div>
          <div className="flex items-start space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
            <p className="text-sm text-muted-foreground">
              <strong>Red (&gt;500ms):</strong> Needs optimization
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
