import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

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

export function useWebSocketNotifications() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      console.log('🔌 WebSocket: Not authenticated or no user ID, skipping connection');
      return;
    }

    console.log('🔌 WebSocket: Creating connection for user:', user.id);
    
    // Create WebSocket connection
    // Use environment variable if available, otherwise construct from current location
    let wsUrl: string;
    
    if (import.meta.env.VITE_WEBSOCKET_URL) {
      // Use explicit WebSocket URL from environment variable
      wsUrl = `${import.meta.env.VITE_WEBSOCKET_URL}/ws/notifications?userId=${user.id}`;
    } else {
      // Fallback to constructing from current location
      let host = window.location.host;
      
      // If host is undefined or doesn't contain a port, use localhost:5000 as fallback
      if (!host || host === 'localhost' || !host.includes(':')) {
        host = 'localhost:5000';
      }
      
      wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${host}/ws/notifications?userId=${user.id}`;
    }
    console.log('🔌 WebSocket: Connecting to:', wsUrl);
    
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
    } catch (error) {
      console.error('🔌 WebSocket: Failed to create WebSocket connection:', error);
      setConnectionError('Failed to create WebSocket connection');
      return;
    }

    // Connection opened
    ws.onopen = () => {
      console.log('🔌 WebSocket: Connected successfully');
      setIsConnected(true);
      setConnectionError(null);
      
      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    // Message received
    ws.onmessage = (event) => {
      try {
        const notificationEvent: NotificationEvent = JSON.parse(event.data);
        console.log('🔌 WebSocket: Message received:', notificationEvent);
        
        if (notificationEvent.type === 'connected') {
          console.log('🔌 WebSocket: Connection confirmed');
        } else if (notificationEvent.type === 'new_notification') {
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

          console.log('🔌 WebSocket: New notification received:', notification);
        } else if (notificationEvent.type === 'pong') {
          console.log('🔌 WebSocket: Pong received');
        }
      } catch (error) {
        console.error('🔌 WebSocket: Error parsing message:', error);
      }
    };

    // Connection closed
    ws.onclose = (event) => {
      console.log('🔌 WebSocket: Connection closed', event.code, event.reason);
      setIsConnected(false);
      
      // Attempt to reconnect after 3 seconds
      if (event.code !== 1000) { // Don't reconnect if closed normally
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔌 WebSocket: Attempting to reconnect...');
          // The useEffect will run again and create a new connection
        }, 3000);
      }
    };

    // Connection error
    ws.onerror = (error) => {
      console.error('🔌 WebSocket: Connection error:', error);
      setIsConnected(false);
      setConnectionError('Connection error occurred');
    };

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
      setIsConnected(false);
    };
  }, [isAuthenticated, user?.id, toast, queryClient]);

  // Manual reconnection function
  const reconnect = () => {
    console.log('🔌 WebSocket: Manual reconnection triggered');
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionError(null);
    setIsConnected(false);
    // The useEffect will automatically create a new connection
  };

  // Send ping to test connection
  const ping = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
      console.log('🔌 WebSocket: Ping sent');
    }
  };

  return {
    isConnected,
    connectionError,
    reconnect,
    ping
  };
}
