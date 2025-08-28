import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export function useAuth() {
  const [authChecked, setAuthChecked] = useState(false);
  
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  useEffect(() => {
    if (!isLoading) {
      setAuthChecked(true);
    }
  }, [isLoading]);

  // If we have an error (like 401), consider auth check complete
  const actuallyLoading = isLoading && !authChecked && !error;

  return {
    user,
    isLoading: actuallyLoading,
    isAuthenticated: !!user && !error,
    error,
  };
}
