// Performance monitoring utilities

interface PerformanceMetrics {
  apiResponseTime: number;
  cacheHit: boolean;
  endpoint: string;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 100; // Keep only last 100 metrics

  recordApiCall(endpoint: string, responseTime: number, cacheHit: boolean = false) {
    const metric: PerformanceMetrics = {
      apiResponseTime: responseTime,
      cacheHit,
      endpoint,
      timestamp: Date.now()
    };

    this.metrics.push(metric);
    
    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log performance in development
    if (import.meta.env.DEV) {
      console.log(`🚀 API Performance: ${endpoint} - ${responseTime}ms ${cacheHit ? '(cached)' : ''}`);
    }
  }

  getAverageResponseTime(endpoint?: string): number {
    const relevantMetrics = endpoint 
      ? this.metrics.filter(m => m.endpoint === endpoint)
      : this.metrics;

    if (relevantMetrics.length === 0) return 0;

    const total = relevantMetrics.reduce((sum, metric) => sum + metric.apiResponseTime, 0);
    return total / relevantMetrics.length;
  }

  getCacheHitRate(endpoint?: string): number {
    const relevantMetrics = endpoint 
      ? this.metrics.filter(m => m.endpoint === endpoint)
      : this.metrics;

    if (relevantMetrics.length === 0) return 0;

    const cacheHits = relevantMetrics.filter(m => m.cacheHit).length;
    return (cacheHits / relevantMetrics.length) * 100;
  }

  getRecentMetrics(count: number = 10): PerformanceMetrics[] {
    return this.metrics.slice(-count);
  }

  clearMetrics() {
    this.metrics = [];
  }

  // Get performance summary
  getSummary() {
    const totalCalls = this.metrics.length;
    const avgResponseTime = this.getAverageResponseTime();
    const cacheHitRate = this.getCacheHitRate();
    
    return {
      totalCalls,
      avgResponseTime: Math.round(avgResponseTime),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      endpoints: [...new Set(this.metrics.map(m => m.endpoint))]
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Enhanced fetch wrapper with performance monitoring
export async function monitoredFetch(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const startTime = performance.now();
  
  try {
    const response = await fetch(url, options);
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    // Extract endpoint from URL
    const endpoint = url.replace(window.location.origin, '');
    
    // Check if response was cached (simplified check)
    const cacheHit = response.headers.get('x-cache') === 'HIT' || 
                    response.headers.get('cf-cache-status') === 'HIT';
    
    performanceMonitor.recordApiCall(endpoint, responseTime, cacheHit);
    
    return response;
  } catch (error) {
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    const endpoint = url.replace(window.location.origin, '');
    
    performanceMonitor.recordApiCall(endpoint, responseTime, false);
    throw error;
  }
}

// Hook for monitoring component performance
export function usePerformanceMonitor(componentName: string) {
  const startTime = performance.now();
  
  return {
    endMonitoring: () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      if (import.meta.env.DEV) {
        console.log(`🎨 Component Performance: ${componentName} - ${renderTime.toFixed(2)}ms`);
      }
    }
  };
}

// Utility to measure function execution time
export function measureExecutionTime<T>(
  fn: () => T | Promise<T>,
  label: string
): T | Promise<T> {
  const startTime = performance.now();
  
  const result = fn();
  
  if (result instanceof Promise) {
    return result.finally(() => {
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      if (import.meta.env.DEV) {
        console.log(`⏱️ Execution Time: ${label} - ${executionTime.toFixed(2)}ms`);
      }
    });
  } else {
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    if (import.meta.env.DEV) {
      console.log(`⏱️ Execution Time: ${label} - ${executionTime.toFixed(2)}ms`);
    }
    
    return result;
  }
}
