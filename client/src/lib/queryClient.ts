import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { performanceMonitor } from "./performance";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorData;
    const contentType = res.headers.get("content-type");
    
    if (contentType && contentType.includes("application/json")) {
      try {
        errorData = await res.json();
      } catch (e) {
        // If JSON parsing fails, fall back to text
        const text = await res.text() || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      // Throw the parsed error data so it can be accessed in error handlers
      throw errorData;
    } else {
      const text = await res.text() || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const startTime = performance.now();
    const url = queryKey.join("/") as string;
    
    const res = await fetch(url, {
      credentials: "include",
    });

    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    // Check if response was cached
    const cacheHit = res.headers.get('x-cache') === 'HIT' || 
                    res.headers.get('cf-cache-status') === 'HIT';
    
    // Record performance metrics
    performanceMonitor.recordApiCall(url, responseTime, cacheHit);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes for better performance
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Retry only once for server errors
        return failureCount < 1;
      },
      retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000), // Faster retry
    },
    mutations: {
      retry: false, // No retry for mutations
    },
  },
});
