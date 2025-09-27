import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';

interface NotificationEvent {
  type: string;
  data: any;
  userId: string;
}

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

class WebSocketNotificationBroadcaster {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, AuthenticatedWebSocket[]> = new Map();

  /**
   * Initialize WebSocket server
   */
  initialize(server: any): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/notifications'
    });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
      console.log('🔌 WebSocket: New connection attempt');
      
      // Parse query parameters to get user ID
      const url = parse(req.url || '', true);
      const userId = url.query?.userId as string;
      
      if (!userId) {
        console.log('❌ WebSocket: No userId provided, closing connection');
        ws.close(1008, 'User ID required');
        return;
      }

      // Set up the connection
      ws.userId = userId;
      ws.isAlive = true;
      
      // Add to clients map
      if (!this.clients.has(userId)) {
        this.clients.set(userId, []);
      }
      this.clients.get(userId)!.push(ws);
      
      console.log(`✅ WebSocket: User ${userId} connected. Total clients: ${this.getTotalClients()}`);

      // Send connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'WebSocket connection established',
        userId: userId,
        timestamp: Date.now()
      }));

      // Set up heartbeat
      const heartbeat = setInterval(() => {
        if (ws.isAlive === false) {
          console.log(`💔 WebSocket: User ${userId} heartbeat failed, removing connection`);
          this.removeClient(userId, ws);
          clearInterval(heartbeat);
          return;
        }
        
        ws.isAlive = false;
        ws.ping();
      }, 30000); // 30 seconds

      // Handle pong response
      ws.on('pong', () => {
        ws.isAlive = true;
        console.log(`💓 WebSocket: Heartbeat received from user ${userId}`);
      });

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(`📨 WebSocket: Message from user ${userId}:`, message);
          
          // Handle different message types
          if (message.type === 'ping') {
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: Date.now()
            }));
          }
        } catch (error) {
          console.error(`❌ WebSocket: Error parsing message from user ${userId}:`, error);
        }
      });

      // Handle connection close
      ws.on('close', (code: number, reason: Buffer) => {
        console.log(`🔌 WebSocket: User ${userId} disconnected. Code: ${code}, Reason: ${reason.toString()}`);
        clearInterval(heartbeat);
        this.removeClient(userId, ws);
      });

      // Handle connection errors
      ws.on('error', (error: Error) => {
        console.error(`❌ WebSocket: Error for user ${userId}:`, error);
        clearInterval(heartbeat);
        this.removeClient(userId, ws);
      });
    });

    console.log('🚀 WebSocket notification server initialized');
  }

  /**
   * Remove a client from receiving notifications
   */
  private removeClient(userId: string, ws: AuthenticatedWebSocket): void {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const index = userClients.indexOf(ws);
      if (index > -1) {
        userClients.splice(index, 1);
      }
      if (userClients.length === 0) {
        this.clients.delete(userId);
      }
    }
  }

  /**
   * Broadcast a notification to a specific user
   */
  broadcastToUser(userId: string, event: NotificationEvent): void {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const message = JSON.stringify(event);
      userClients.forEach(client => {
        try {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
            console.log(`📤 WebSocket: Notification sent to user ${userId}`);
          } else {
            // Remove dead connections
            this.removeClient(userId, client);
          }
        } catch (error) {
          console.error(`❌ WebSocket: Failed to send to user ${userId}:`, error);
          this.removeClient(userId, client);
        }
      });
    }
  }

  /**
   * Broadcast a notification to all connected users
   */
  broadcastToAll(event: NotificationEvent): void {
    this.clients.forEach((clients, userId) => {
      this.broadcastToUser(userId, event);
    });
  }

  /**
   * Get the number of connected clients for a user
   */
  getClientCount(userId: string): number {
    return this.clients.get(userId)?.length || 0;
  }

  /**
   * Get total connected clients
   */
  getTotalClients(): number {
    let total = 0;
    this.clients.forEach(clients => {
      total += clients.length;
    });
    return total;
  }

  /**
   * Get connection status for a user
   */
  isUserConnected(userId: string): boolean {
    return this.getClientCount(userId) > 0;
  }
}

export const websocketNotificationBroadcaster = new WebSocketNotificationBroadcaster();
