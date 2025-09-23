import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface DeliveryFeeData {
  distance: number;
  duration: number;
  deliveryCharge: number;
  isFreeDelivery: boolean;
  reason: string;
}

interface UseDeliveryFeeOptions {
  addressId: number | null;
  enabled?: boolean;
}

export function useDeliveryFee({ addressId, enabled = true }: UseDeliveryFeeOptions) {
  const [deliveryData, setDeliveryData] = useState<DeliveryFeeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading: queryLoading, error: queryError, refetch } = useQuery({
    queryKey: ['/api/delivery-fee', addressId],
    queryFn: async () => {
      if (!addressId) return null;
      const response = await apiRequest('POST', '/api/delivery-fee', { addressId });
      const data = await response.json();
      return data;
    },
    enabled: enabled && !!addressId,
    retry: 1,
    staleTime: 0, // Don't cache to ensure fresh data
  });

  useEffect(() => {
    if (data) {
      setDeliveryData(data as DeliveryFeeData);
      setError(null);
    } else if (queryError) {
      setError('Failed to calculate delivery fee');
      setDeliveryData(null);
    }
    setIsLoading(queryLoading);
  }, [data, queryError, queryLoading]);

  const calculateDeliveryFee = async () => {
    if (addressId) {
      setIsLoading(true);
      setError(null);
      try {
        const result = await refetch();
        return result.data;
      } catch (err) {
        setError('Failed to calculate delivery fee');
        return null;
      } finally {
        setIsLoading(false);
      }
    }
    return null;
  };

  return {
    deliveryData,
    isLoading,
    error,
    calculateDeliveryFee,
    refetch
  };
}
