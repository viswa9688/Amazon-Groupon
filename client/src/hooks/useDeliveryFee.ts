import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface DeliveryFeeData {
  distance: number;
  duration: number;
  deliveryCharge: number;
  isFreeDelivery: boolean;
  reason: string;
  deliveryFeePerKm?: number;
  deliveryRadiusKm?: number;
}

interface UseDeliveryFeeOptions {
  addressId: number | null;
  enabled?: boolean;
  orderType?: 'individual' | 'group';
  orderTotal?: number;
  productId?: number;
  userGroupId?: number;
}

export function useDeliveryFee({ addressId, enabled = true, orderType = 'individual', orderTotal = 0, productId, userGroupId }: UseDeliveryFeeOptions) {
  const [deliveryData, setDeliveryData] = useState<DeliveryFeeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryEnabled = enabled && !!addressId && (orderType === 'individual' || (orderType === 'group' && userGroupId !== null));
  console.log('🔍 useDeliveryFee query enabled:', queryEnabled, { enabled, addressId, orderType, userGroupId });

  const { data, isLoading: queryLoading, error: queryError, refetch } = useQuery({
    queryKey: ['/api/delivery-fee', addressId, orderType, orderTotal, productId, userGroupId],
    queryFn: async () => {
      if (!addressId) return null;
      console.log('🚀 useDeliveryFee API request:', { addressId, orderType, orderTotal, productId, userGroupId });
      const response = await apiRequest('POST', '/api/delivery-fee', { addressId, orderType, orderTotal, productId, userGroupId });
      const data = await response.json();
      console.log('📥 useDeliveryFee API response:', data);
      return data;
    },
    enabled: queryEnabled,
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
