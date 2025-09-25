import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Truck, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface CustomerDeliveryInfoProps {
  expectedDeliveryDate?: string | Date;
  actualDeliveryDate?: string | Date;
  orderTime?: string | Date;
  status?: string;
  showCutoffInfo?: boolean;
  compact?: boolean;
}

export default function CustomerDeliveryInfo({
  expectedDeliveryDate,
  actualDeliveryDate,
  orderTime,
  status,
  showCutoffInfo = true,
  compact = false
}: CustomerDeliveryInfoProps) {
  
  const formatDate = (date: string | Date | undefined) => {
    if (!date) return null;
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'MMM dd, yyyy');
  };

  const formatTime = (date: string | Date | undefined) => {
    if (!date) return null;
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'h:mm a');
  };

  const getDeliveryStatus = () => {
    if (!status) return null;
    
    switch (status.toLowerCase()) {
      case 'delivered':
      case 'completed':
        return { 
          icon: CheckCircle, 
          color: 'text-green-600', 
          bgColor: 'bg-green-100',
          text: 'Delivered',
          message: 'Your order has been delivered successfully!'
        };
      case 'out_for_delivery':
        return { 
          icon: Truck, 
          color: 'text-blue-600', 
          bgColor: 'bg-blue-100',
          text: 'Out for Delivery',
          message: 'Your order is on its way to you!'
        };
      case 'shipped':
        return { 
          icon: Truck, 
          color: 'text-blue-600', 
          bgColor: 'bg-blue-100',
          text: 'Shipped',
          message: 'Your order has been shipped and is in transit.'
        };
      case 'processing':
        return { 
          icon: Clock, 
          color: 'text-yellow-600', 
          bgColor: 'bg-yellow-100',
          text: 'Processing',
          message: 'Your order is being prepared for shipment.'
        };
      default:
        return { 
          icon: AlertCircle, 
          color: 'text-gray-600', 
          bgColor: 'bg-gray-100',
          text: 'Pending',
          message: 'Your order is being processed.'
        };
    }
  };

  const getCutoffInfo = () => {
    if (!orderTime) return null;
    
    const orderDate = typeof orderTime === 'string' ? new Date(orderTime) : orderTime;
    const orderHour = orderDate.getHours();
    const isAfterCutoff = orderHour >= 12;
    
    return {
      isAfterCutoff,
      message: isAfterCutoff 
        ? "Order placed after 12:00 PM - Next day delivery"
        : "Order placed before 12:00 PM - Same day delivery",
      icon: isAfterCutoff ? AlertCircle : CheckCircle,
      color: isAfterCutoff ? 'text-orange-600' : 'text-green-600'
    };
  };

  const deliveryStatus = getDeliveryStatus();
  const cutoffInfo = getCutoffInfo();

  if (compact) {
    return (
      <div className="space-y-2">
        {/* Delivery Status */}
        {deliveryStatus && (
          <div className="flex items-center gap-2">
            <Badge className={`${deliveryStatus.bgColor} ${deliveryStatus.color} border-0`}>
              <deliveryStatus.icon className="w-3 h-3 mr-1" />
              {deliveryStatus.text}
            </Badge>
          </div>
        )}

        {/* Expected Delivery Date */}
        {expectedDeliveryDate && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-muted-foreground">Expected:</span>
            <span className="font-medium text-blue-600">
              {formatDate(expectedDeliveryDate)}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      {/* Delivery Status */}
      {deliveryStatus && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge className={`${deliveryStatus.bgColor} ${deliveryStatus.color} border-0`}>
              <deliveryStatus.icon className="w-3 h-3 mr-1" />
              {deliveryStatus.text}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {deliveryStatus.message}
          </p>
        </div>
      )}

      {/* Order Time Info */}
      {orderTime && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Ordered: {formatDate(orderTime)} at {formatTime(orderTime)}</span>
        </div>
      )}

      {/* Cutoff Information */}
      {showCutoffInfo && cutoffInfo && (
        <div className={`text-sm p-3 rounded-md border ${
          cutoffInfo.isAfterCutoff 
            ? 'bg-orange-50 text-orange-700 border-orange-200' 
            : 'bg-green-50 text-green-700 border-green-200'
        }`}>
          <div className="flex items-center gap-2">
            <cutoffInfo.icon className="w-4 h-4" />
            <span>{cutoffInfo.message}</span>
          </div>
        </div>
      )}

      {/* Expected Delivery Date */}
      {expectedDeliveryDate && (
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span className="text-muted-foreground">Expected Delivery:</span>
          <span className="font-medium text-blue-600">
            {formatDate(expectedDeliveryDate)}
          </span>
        </div>
      )}

      {/* Actual Delivery Date */}
      {actualDeliveryDate && (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-muted-foreground">Delivered:</span>
          <span className="font-medium text-green-600">
            {formatDate(actualDeliveryDate)}
          </span>
        </div>
      )}
    </div>
  );
}
