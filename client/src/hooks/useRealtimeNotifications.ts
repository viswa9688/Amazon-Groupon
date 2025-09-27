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
    console.log('🔔 SSE: useEffect triggered');
    console.log('🔔 SSE: isAuthenticated:', isAuthenticated);
    console.log('🔔 SSE: user:', user);
    console.log('🔔 SSE: user?.id:', user?.id);
    
    if (!isAuthenticated || !user?.id) {
      console.log('🔔 SSE: Not authenticated or no user ID, skipping connection');
      return;
    }

    console.log('🔔 SSE: Creating EventSource connection for user:', user.id);
    console.log('🔔 SSE: Authentication status:', isAuthenticated);
    console.log('🔔 SSE: Window location origin:', window.location.origin);
    console.log('🔔 SSE: Full URL:', `${window.location.origin}/api/notifications/stream`);

    // Create EventSource connection
    const eventSource = new EventSource(`${window.location.origin}/api/notifications/stream`, {
      withCredentials: true
    });

    eventSourceRef.current = eventSource;
    console.log('🔔 SSE: EventSource created, readyState:', eventSource.readyState);

    // Set a timeout to check if connection is established
    const connectionTimeout = setTimeout(() => {
      if (eventSource.readyState === EventSource.OPEN) {
        console.log('🔔 SSE: Connection established via timeout check');
        setIsConnected(true);
        setConnectionError(null);
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        console.log('🔔 SSE: Still connecting, readyState:', eventSource.readyState);
        // Don't set error yet, connection might still be establishing
      } else {
        console.log('🔔 SSE: Connection failed, readyState:', eventSource.readyState);
        setConnectionError('Connection failed');
      }
    }, 5000); // Increased timeout to 5 seconds

    // Handle connection open
    eventSource.onopen = (event) => {
      console.log('🔔 Real-time notifications connected successfully');
      console.log('🔔 EventSource onopen event:', event);
      console.log('🔔 EventSource readyState:', eventSource.readyState);
      clearTimeout(connectionTimeout);
      setIsConnected(true);
      setConnectionError(null);
    };

    // Handle incoming messages
    eventSource.onmessage = (event) => {
      console.log('🔔 SSE: Message received:', event.data);
      
      // Clear any connection timeout since we're receiving messages
      clearTimeout(connectionTimeout);
      setIsConnected(true);
      setConnectionError(null);
      
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
          console.log('💓 Heartbeat received from server');
        }
      } catch (error) {
        console.error('Error parsing notification event:', error);
      }
    };

    // Handle connection errors
    eventSource.onerror = (error) => {
      console.error('❌ Real-time notifications error:', error);
      console.error('❌ EventSource readyState:', eventSource.readyState);
      console.error('❌ EventSource URL:', eventSource.url);
      setIsConnected(false);
      setConnectionError('Connection lost. Attempting to reconnect...');
      
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          console.log('🔄 Attempting to reconnect to real-time notifications...');
          // The useEffect will run again and create a new connection
        }
      }, 5000);
    };

    // Cleanup on unmount
    return () => {
      clearTimeout(connectionTimeout);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [isAuthenticated, user?.id, toast]);

  // Manual reconnection function
  const reconnect = () => {
    console.log('🔄 Manual reconnection triggered');
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnectionError(null);
    setIsConnected(false);
    // The useEffect will automatically create a new connection
  };

  return {
    isConnected,
    connectionError,
    reconnect
  };
}
