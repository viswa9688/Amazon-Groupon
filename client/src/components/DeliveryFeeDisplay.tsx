import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Clock, Truck, CheckCircle, AlertCircle } from "lucide-react";
import { useDeliveryFee } from "@/hooks/useDeliveryFee";

interface DeliveryFeeDisplayProps {
  addressId: number | null;
  className?: string;
  onDeliveryFeeChange?: (fee: number) => void;
}

export default function DeliveryFeeDisplay({ addressId, className, onDeliveryFeeChange }: DeliveryFeeDisplayProps) {
  const { deliveryData, isLoading, error } = useDeliveryFee({ addressId });

  // Notify parent component when delivery fee changes
  useEffect(() => {
    if (deliveryData && onDeliveryFeeChange) {
      onDeliveryFeeChange(deliveryData.deliveryCharge);
    }
  }, [deliveryData, onDeliveryFeeChange]);

  if (!addressId) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <span>Delivery Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Select a delivery address to see delivery information</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <span>Delivery Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
            <span className="text-muted-foreground">Calculating delivery fee...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <span>Delivery Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4 text-red-600">
            <AlertCircle className="w-6 h-6 mr-2" />
            <span>Unable to calculate delivery fee</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!deliveryData || typeof deliveryData !== 'object') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <span>Delivery Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <p>No delivery information available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { distance, duration, deliveryCharge, isFreeDelivery, reason } = deliveryData || {};


  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Truck className="w-5 h-5 text-blue-600" />
          <span>Delivery Information</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Distance and Duration */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium">Distance</p>
              <p className="text-lg font-bold text-gray-900">{distance ? distance.toFixed(1) : '0.0'} km</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-sm font-medium">Est. Time</p>
              <p className="text-lg font-bold text-gray-900">{duration || 0} min</p>
            </div>
          </div>
        </div>

        {/* Delivery Fee */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isFreeDelivery ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <Truck className="w-5 h-5 text-blue-600" />
              )}
              <div>
                <p className="font-medium">Delivery Fee</p>
                <p className="text-sm text-muted-foreground">{reason || 'Calculating delivery information...'}</p>
              </div>
            </div>
            <div className="text-right">
              {isFreeDelivery ? (
                <div>
                  <p className="text-lg font-bold text-green-600">$0.00</p>
                  <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                    Free Delivery
                  </Badge>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-bold text-gray-900">${deliveryCharge ? deliveryCharge.toFixed(2) : '0.00'}</p>
                  <p className="text-xs text-muted-foreground">$5.99 per km beyond 10km</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Additional Info */}
        {!isFreeDelivery && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Delivery Policy:</strong> Free delivery for orders within 10km. 
              Orders beyond 10km are charged $5.99 per additional kilometer.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
