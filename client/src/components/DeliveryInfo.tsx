import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Truck, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface DeliveryInfoProps {
  expectedDeliveryDate?: string | Date;
  actualDeliveryDate?: string | Date;
  orderTime?: string | Date;
  status?: string;
  showOrderTime?: boolean;
  showCutoffInfo?: boolean;
}

export default function DeliveryInfo({
  expectedDeliveryDate,
  actualDeliveryDate,
  orderTime,
  status,
  showOrderTime = false,
  showCutoffInfo = false
}: DeliveryInfoProps) {
  
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
          text: 'Delivered'
        };
      case 'shipped':
      case 'out_for_delivery':
        return { 
          icon: Truck, 
          color: 'text-blue-600', 
          bgColor: 'bg-blue-100',
          text: 'In Transit'
        };
      case 'processing':
        return { 
          icon: Clock, 
          color: 'text-yellow-600', 
          bgColor: 'bg-yellow-100',
          text: 'Processing'
        };
      default:
        return { 
          icon: Clock, 
          color: 'text-gray-600', 
          bgColor: 'bg-gray-100',
          text: 'Pending'
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
        : "Order placed before 12:00 PM - Same day delivery"
    };
  };

  const deliveryStatus = getDeliveryStatus();
  const cutoffInfo = getCutoffInfo();

  return (
    <div className="space-y-3">
      {/* Delivery Status */}
      {deliveryStatus && (
        <div className="flex items-center gap-2">
          <Badge className={`${deliveryStatus.bgColor} ${deliveryStatus.color} border-0`}>
            <deliveryStatus.icon className="w-3 h-3 mr-1" />
            {deliveryStatus.text}
          </Badge>
        </div>
      )}

      {/* Order Time Info */}
      {showOrderTime && orderTime && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Ordered: {formatDate(orderTime)} at {formatTime(orderTime)}</span>
        </div>
      )}

      {/* Cutoff Information */}
      {showCutoffInfo && cutoffInfo && (
        <div className={`text-sm p-2 rounded-md ${
          cutoffInfo.isAfterCutoff 
            ? 'bg-orange-50 text-orange-700 border border-orange-200' 
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
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
