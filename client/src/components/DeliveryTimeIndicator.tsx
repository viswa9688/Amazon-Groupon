import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle } from "lucide-react";

interface DeliveryTimeIndicatorProps {
  className?: string;
}

export default function DeliveryTimeIndicator({ className = "" }: DeliveryTimeIndicatorProps) {
  const now = new Date();
  const cutoffHour = 12; // 12:00 PM cutoff
  const currentHour = now.getHours();
  
  const isAfterCutoff = currentHour >= cutoffHour;
  
  const getTimeUntilCutoff = () => {
    const cutoff = new Date(now);
    cutoff.setHours(cutoffHour, 0, 0, 0); // 12:00 PM
    
    // If it's already past cutoff today, show cutoff for tomorrow
    if (now >= cutoff) {
      cutoff.setDate(cutoff.getDate() + 1);
    }
    
    const diffMs = cutoff.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return { hours, minutes };
  };

  const { hours, minutes } = getTimeUntilCutoff();

  if (isAfterCutoff) {
    return (
      <Badge 
        variant="outline" 
        className={`${className} bg-orange-50 text-orange-700 border-orange-200`}
      >
        <AlertCircle className="w-3 h-3 mr-1" />
        Next Day Delivery
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={`${className} bg-green-50 text-green-700 border-green-200`}
    >
      <Clock className="w-3 h-3 mr-1" />
      {hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`} for Same Day
    </Badge>
  );
}
