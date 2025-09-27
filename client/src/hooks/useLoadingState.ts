import { useState, useCallback, useRef, useEffect } from 'react';

interface UseLoadingStateOptions {
  initialLoading?: boolean;
  debounceMs?: number;
  minLoadingTime?: number;
}

interface LoadingState {
  isLoading: boolean;
  error: string | null;
  startLoading: () => void;
  stopLoading: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export function useLoadingState(options: UseLoadingStateOptions = {}): LoadingState {
  const {
    initialLoading = false,
    debounceMs = 100,
    minLoadingTime = 500
  } = options;

  const [isLoading, setIsLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<number>();

  const startLoading = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      startTimeRef.current = Date.now();
      setIsLoading(true);
      setError(null);
    }, debounceMs);
  }, [debounceMs]);

  const stopLoading = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
    const remainingTime = Math.max(0, minLoadingTime - elapsed);

    setTimeout(() => {
      setIsLoading(false);
    }, remainingTime);
  }, [minLoadingTime]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    isLoading,
    error,
    startLoading,
    stopLoading,
    setError,
    clearError
  };
}

// Hook for managing multiple loading states
export function useMultipleLoadingStates<T extends string>(
  keys: T[],
  options: UseLoadingStateOptions = {}
): Record<T, LoadingState> & {
  isAnyLoading: boolean;
  isAllLoading: boolean;
  clearAllErrors: () => void;
} {
  const states = keys.reduce((acc, key) => {
    acc[key] = useLoadingState(options);
    return acc;
  }, {} as Record<T, LoadingState>);

  const isAnyLoading = Object.values(states).some(state => state.isLoading);
  const isAllLoading = Object.values(states).every(state => state.isLoading);

  const clearAllErrors = useCallback(() => {
    Object.values(states).forEach(state => state.clearError());
  }, [states]);

  return {
    ...states,
    isAnyLoading,
    isAllLoading,
    clearAllErrors
  };
}

// Hook for async operations with loading state
export function useAsyncOperation<T extends any[], R>(
  operation: (...args: T) => Promise<R>,
  options: UseLoadingStateOptions = {}
) {
  const { isLoading, error, startLoading, stopLoading, setError } = useLoadingState(options);

  const execute = useCallback(async (...args: T): Promise<R | null> => {
    try {
      startLoading();
      const result = await operation(...args);
      stopLoading();
      return result;
    } catch (err) {
      stopLoading();
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      return null;
    }
  }, [operation, startLoading, stopLoading, setError]);

  return {
    execute,
    isLoading,
    error,
    clearError: () => setError(null)
  };
}
