// Performance monitoring utilities
import { performance } from 'perf_hooks';

interface PerformanceMetrics {
  endpoint: string;
  responseTime: number;
  timestamp: number;
  cacheHit: boolean;
  error?: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 1000; // Keep last 1000 requests

  recordRequest(endpoint: string, responseTime: number, cacheHit: boolean, error?: string) {
    this.metrics.push({
      endpoint,
      responseTime,
      timestamp: Date.now(),
      cacheHit,
      error,
    });

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log slow requests
    if (responseTime > 1000) { // > 1 second
      console.warn(`🐌 Slow request: ${endpoint} took ${responseTime.toFixed(2)}ms`);
    }
  }

  getStats() {
    const now = Date.now();
    const last5Minutes = this.metrics.filter(m => now - m.timestamp < 5 * 60 * 1000);
    const last1Minute = this.metrics.filter(m => now - m.timestamp < 60 * 1000);

    const avgResponseTime = last5Minutes.length > 0 
      ? last5Minutes.reduce((sum, m) => sum + m.responseTime, 0) / last5Minutes.length 
      : 0;

    const cacheHitRate = last5Minutes.length > 0
      ? (last5Minutes.filter(m => m.cacheHit).length / last5Minutes.length) * 100
      : 0;

    const errorRate = last5Minutes.length > 0
      ? (last5Minutes.filter(m => m.error).length / last5Minutes.length) * 100
      : 0;

    return {
      totalRequests: this.metrics.length,
      requestsLast5Min: last5Minutes.length,
      requestsLast1Min: last1Minute.length,
      avgResponseTime: Math.round(avgResponseTime),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      slowRequests: last5Minutes.filter(m => m.responseTime > 1000).length,
    };
  }

  getSlowEndpoints() {
    const now = Date.now();
    const last5Minutes = this.metrics.filter(m => now - m.timestamp < 5 * 60 * 1000);
    
    const endpointStats = new Map<string, { count: number; totalTime: number; avgTime: number }>();
    
    last5Minutes.forEach(metric => {
      const existing = endpointStats.get(metric.endpoint) || { count: 0, totalTime: 0, avgTime: 0 };
      existing.count++;
      existing.totalTime += metric.responseTime;
      existing.avgTime = existing.totalTime / existing.count;
      endpointStats.set(metric.endpoint, existing);
    });

    return Array.from(endpointStats.entries())
      .filter(([_, stats]) => stats.avgTime > 500) // > 500ms average
      .sort((a, b) => b[1].avgTime - a[1].avgTime)
      .slice(0, 10); // Top 10 slowest
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Middleware to track performance
export function performanceMiddleware(req: any, res: any, next: any) {
  const startTime = performance.now();
  
  res.on('finish', () => {
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    const cacheHit = res.get('X-Cache-Status') === 'HIT';
    
    performanceMonitor.recordRequest(
      req.path,
      responseTime,
      cacheHit,
      res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined
    );
  });
  
  next();
}
