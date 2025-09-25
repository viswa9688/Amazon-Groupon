import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Calendar, Truck, CheckCircle, AlertCircle, Package } from "lucide-react";
import { format } from "date-fns";

interface CustomerDeliveryTrackerProps {
  orderId: number;
  status: string;
  expectedDeliveryDate?: string | Date;
  actualDeliveryDate?: string | Date;
  orderTime?: string | Date;
  showCutoffInfo?: boolean;
}

export default function CustomerDeliveryTracker({
  orderId,
  status,
  expectedDeliveryDate,
  actualDeliveryDate,
  orderTime,
  showCutoffInfo = true
}: CustomerDeliveryTrackerProps) {
  
  const formatDate = (date: string | Date | undefined) => {
    if (!date) return null;
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'dd/MM/yyyy');
  };

  const formatFullDate = (date: string | Date | undefined) => {
    if (!date) return null;
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'EEEE, MMMM dd, yyyy');
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

  const getStatusProgress = () => {
    const stages = [
      { key: 'pending', label: 'Order Placed', icon: Package, color: 'green' },
      { key: 'processing', label: 'Processing', icon: Clock, color: 'blue' },
      { key: 'shipped', label: 'Shipped', icon: Truck, color: 'blue' },
      { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck, color: 'blue' },
      { key: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'green' }
    ];

    const currentStatusIndex = stages.findIndex(stage => stage.key === status);
    const completedIndex = Math.max(0, currentStatusIndex);
    
    return { stages, currentStatusIndex, completedIndex };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Delivered</Badge>;
      case 'out_for_delivery':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Out for Delivery</Badge>;
      case 'shipped':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Shipped</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Processing</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Pending</Badge>;
    }
  };

  const { stages, currentStatusIndex, completedIndex } = getStatusProgress();
  const cutoffInfo = getCutoffInfo();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Order #{orderId}</span>
          {getStatusBadge(status)}
        </CardTitle>
        {orderTime && (
          <p className="text-sm text-muted-foreground">
            Ordered: {formatFullDate(orderTime)}
          </p>
        )}
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
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Delivery Status Tracker */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Delivery Status</h3>
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              <div 
                className="absolute left-4 top-0 w-0.5 bg-green-500 transition-all duration-500"
                style={{ 
                  height: `${Math.max(0, (completedIndex / (stages.length - 1)) * 100)}%` 
                }}
              ></div>

              {/* Status Stages */}
              <div className="space-y-6">
                {stages.map((stage, index) => {
                  const isCompleted = index <= completedIndex;
                  const isCurrent = index === currentStatusIndex;
                  const isPending = index > currentStatusIndex;
                  
                  let circleColor = 'bg-gray-300';
                  let textColor = 'text-gray-500';
                  
                  if (isCompleted) {
                    circleColor = stage.color === 'green' ? 'bg-green-500' : 'bg-blue-500';
                    textColor = 'text-gray-900';
                  } else if (isCurrent) {
                    circleColor = stage.color === 'green' ? 'bg-green-500' : 'bg-blue-500';
                    textColor = 'text-gray-900';
                  }

                  return (
                    <div key={stage.key} className="relative flex items-start gap-4">
                      {/* Status Circle */}
                      <div className={`relative z-10 w-8 h-8 rounded-full ${circleColor} flex items-center justify-center`}>
                        <stage.icon className="w-4 h-4 text-white" />
                      </div>
                      
                      {/* Status Content */}
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium ${textColor}`}>
                          {stage.label}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {stage.key === 'pending' && orderTime && formatDate(orderTime)}
                          {stage.key === 'processing' && '1-2 business days'}
                          {stage.key === 'shipped' && '3-5 business days'}
                          {stage.key === 'out_for_delivery' && 'Final day'}
                          {stage.key === 'delivered' && (actualDeliveryDate ? formatDate(actualDeliveryDate) : 'Order completed')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Delivery Information */}
          <div className="space-y-3 pt-4 border-t">
            {expectedDeliveryDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-muted-foreground">Expected Delivery:</span>
                <span className="font-medium text-blue-600">
                  {formatFullDate(expectedDeliveryDate)}
                </span>
              </div>
            )}
            
            {actualDeliveryDate && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-muted-foreground">Delivered:</span>
                <span className="font-medium text-green-600">
                  {formatFullDate(actualDeliveryDate)}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
