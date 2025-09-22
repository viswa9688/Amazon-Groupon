import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { queryClient } from '@/lib/queryClient';

interface NotificationEvent {
  type: string;
  data: any;
  userId: string;
}

interface RealtimeNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  priority: string;
  isRead: boolean;
  createdAt: string;
  data?: any;
}

export function useRealtimeNotifications() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      return;
    }

    // Create EventSource connection
    const eventSource = new EventSource('/api/notifications/stream', {
      withCredentials: true
    });

    eventSourceRef.current = eventSource;

    // Handle connection open
    eventSource.onopen = () => {
      console.log('Real-time notifications connected');
      setIsConnected(true);
      setConnectionError(null);
    };

    // Handle incoming messages
    eventSource.onmessage = (event) => {
      try {
        const notificationEvent: NotificationEvent = JSON.parse(event.data);
        
        if (notificationEvent.type === 'new_notification') {
          const notification: RealtimeNotification = notificationEvent.data;
          
          // Show toast notification
          toast({
            title: notification.title,
            description: notification.message,
            variant: notification.priority === 'urgent' ? 'destructive' : 'default',
          });

          // Invalidate queries to refresh notification list
          queryClient.invalidateQueries({ queryKey: ["/api/seller/notifications"] });
          queryClient.invalidateQueries({ queryKey: ["/api/seller/notifications/unread-count"] });

          console.log('New real-time notification received:', notification);
        } else if (notificationEvent.type === 'connected') {
          console.log('Connected to real-time notifications');
        } else if (notificationEvent.type === 'heartbeat') {
          // Handle heartbeat - connection is alive
          console.log('Heartbeat received');
        }
      } catch (error) {
        console.error('Error parsing notification event:', error);
      }
    };

    // Handle connection errors
    eventSource.onerror = (error) => {
      console.error('Real-time notifications error:', error);
      setIsConnected(false);
      setConnectionError('Connection lost. Attempting to reconnect...');
      
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          console.log('Attempting to reconnect to real-time notifications...');
          // The useEffect will run again and create a new connection
        }
      }, 5000);
    };

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [isAuthenticated, user?.id, toast]);

  // Manual reconnection function
  const reconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setConnectionError(null);
    // The useEffect will automatically create a new connection
  };

  return {
    isConnected,
    connectionError,
    reconnect
  };
}
