import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Trash2,
  Clock,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import type { SellerNotification } from "@shared/schema";

interface SellerNotificationsProps {
  className?: string;
}

export default function SellerNotifications({ className }: SellerNotificationsProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  
  // Initialize real-time notifications
  const { isConnected, connectionError, reconnect } = useRealtimeNotifications();

  // Fetch notifications - Real-time updates via SSE, no polling needed
  const { data: notifications = [], isLoading } = useQuery<SellerNotification[]>({
    queryKey: ["/api/seller/notifications"],
    enabled: isAuthenticated, // Debug: Removed user?.isSeller check
    // No refetchInterval - real-time updates via SSE
  });

  // Fetch unread count - Real-time updates via SSE, no polling needed
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/seller/notifications/unread-count"],
    enabled: isAuthenticated, // Debug: Removed user?.isSeller check
    // No refetchInterval - real-time updates via SSE
  });

  const unreadCount = unreadData?.count || 0;

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest("PATCH", `/api/seller/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seller/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/seller/notifications/unread-count"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", "/api/seller/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seller/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/seller/notifications/unread-count"] });
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive",
      });
    },
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest("DELETE", `/api/seller/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seller/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/seller/notifications/unread-count"] });
      toast({
        title: "Success",
        description: "Notification deleted",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      });
    },
  });

  const getNotificationIcon = (type: string, priority: string) => {
    const iconClass = "w-4 h-4";
    
    switch (type) {
      case "new_order":
        return <BellRing className={`${iconClass} text-green-600`} />;
      case "order_status_change":
        return <CheckCircle className={`${iconClass} text-blue-600`} />;
      case "payment_received":
        return <CheckCircle className={`${iconClass} text-green-600`} />;
      case "low_stock":
        return <AlertCircle className={`${iconClass} text-orange-600`} />;
      case "urgent":
        return <XCircle className={`${iconClass} text-red-600`} />;
      case "group_owner_reminder":
        return <BellRing className={`${iconClass} text-purple-600`} />;
      default:
        return <Info className={`${iconClass} text-gray-600`} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "destructive";
      case "high":
        return "default";
      case "normal":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "secondary";
    }
  };

  const handleMarkAsRead = (notificationId: number) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleDelete = (notificationId: number) => {
    deleteNotificationMutation.mutate(notificationId);
  };

  // Test notification mutation

  // Debug: Show component for all authenticated users for testing
  if (!isAuthenticated) {
    return null;
  }

  // Debug: Log user data
  console.log("SellerNotifications - User data:", user);
  console.log("SellerNotifications - isSeller:", user?.isSeller);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className={`relative ${className}`}>
          {unreadCount > 0 ? (
            <BellRing className="w-5 h-5" />
          ) : (
            <Bell className="w-5 h-5" />
          )}
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>Notifications</span>
              {/* Real-time connection status */}
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-muted-foreground">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connectionError && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={reconnect}
                  className="text-xs"
                >
                  Reconnect
                </Button>
              )}
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={markAllAsReadMutation.isPending}
                >
                  <CheckCheck className="w-4 h-4 mr-2" />
                  Mark all read
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[400px]">
          {/* Debug info */}
          <div className="p-4 bg-gray-50 text-xs text-gray-600 mb-4">
            <p>Debug Info:</p>
            <p>User ID: {user?.id}</p>
            <p>Is Seller: {user?.isSeller ? 'Yes' : 'No'}</p>
            <p>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</p>
            <p>Real-time: {isConnected ? 'Connected' : 'Disconnected'}</p>
            <p>Notifications Count: {notifications.length}</p>
            <p>Unread Count: {unreadCount}</p>
            {connectionError && <p className="text-red-600">Error: {connectionError}</p>}
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No notifications yet</p>
              <p className="text-xs mt-2">Click "Test" to create a test notification</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification, index) => (
                <div key={notification.id}>
                  <Card className={`${!notification.isRead ? 'border-l-4 border-l-primary' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          {getNotificationIcon(notification.type, notification.priority)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="text-sm font-medium truncate">
                                {notification.title}
                              </h4>
                              <Badge variant={getPriorityColor(notification.priority)} className="text-xs">
                                {notification.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>
                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 ml-2">
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsRead(notification.id)}
                              disabled={markAsReadMutation.isPending}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(notification.id)}
                            disabled={deleteNotificationMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {index < notifications.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
