import { Request, Response } from "express";

interface NotificationEvent {
  type: string;
  data: any;
  userId: string;
}

class NotificationBroadcaster {
  private clients: Map<string, Response[]> = new Map();

  /**
   * Add a client to receive notifications
   */
  addClient(userId: string, req: Request, res: Response): void {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, []);
    }
    this.clients.get(userId)!.push(res);

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to notifications' })}\n\n`);

    // Handle client disconnect
    req.on('close', () => {
      this.removeClient(userId, res);
    });

    req.on('error', () => {
      this.removeClient(userId, res);
    });
  }

  /**
   * Remove a client from receiving notifications
   */
  removeClient(userId: string, res: Response): void {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const index = userClients.indexOf(res);
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
      const message = `data: ${JSON.stringify(event)}\n\n`;
      userClients.forEach(client => {
        try {
          client.write(message);
        } catch (error) {
          // Remove dead connections
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
}

export const notificationBroadcaster = new NotificationBroadcaster();
