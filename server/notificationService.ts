import { storage } from "./storage";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { 
  users, 
  products, 
  userGroups, 
  userGroupParticipants, 
  groupPayments, 
  orders,
  orderItems,
  sellerNotifications 
} from "@shared/schema";

export interface NotificationData {
  userId?: string;
  sellerId?: string;
  groupId?: number;
  productId?: number;
  orderId?: number;
  paymentId?: number;
  amount?: number;
  groupName?: string;
  productName?: string;
  memberName?: string;
  orderStatus?: string;
  [key: string]: any;
}

export interface NotificationTemplate {
  type: string;
  title: string;
  message: string;
  priority: "low" | "normal" | "high" | "urgent";
  data?: NotificationData;
}

export class NotificationService {
  
  /**
   * Scenario 1: Member requests to join group
   * Notify the group owner when a member requests to join their group
   */
  async notifyGroupJoinRequest(memberId: string, groupId: number): Promise<void> {
    try {
      // Get group details
      const group = await storage.getUserGroup(groupId);
      if (!group) {
        console.error(`Group ${groupId} not found for join request notification`);
        return;
      }

      // Get member details
      const member = await storage.getUser(memberId);
      if (!member) {
        console.error(`Member ${memberId} not found for join request notification`);
        return;
      }

      // Get product details for context
      const productNames = group.items?.map(item => item.product.name).join(", ") || "Multiple products";

      const notification: NotificationTemplate = {
        type: "group_join_request",
        title: "New Join Request",
        message: `${member.firstName} ${member.lastName} wants to join your group "${group.name}" for ${productNames}.`,
        priority: "normal",
        data: {
          userId: memberId,
          groupId,
          groupName: group.name,
          productName: productNames,
          memberName: `${member.firstName} ${member.lastName}`,
          memberEmail: member.email
        }
      };

      await this.createNotification(group.userId, notification);
      console.log(`Join request notification sent to group owner ${group.userId} for group ${groupId}`);
    } catch (error) {
      console.error("Error sending group join request notification:", error);
    }
  }

  /**
   * Scenario 2: Owner accepts member request
   * Notify the member when the owner accepts their join request
   */
  async notifyMemberRequestAccepted(memberId: string, groupId: number): Promise<void> {
    try {
      // Get group details
      const group = await storage.getUserGroup(groupId);
      if (!group) {
        console.error(`Group ${groupId} not found for request accepted notification`);
        return;
      }

      // Get member details
      const member = await storage.getUser(memberId);
      if (!member) {
        console.error(`Member ${memberId} not found for request accepted notification`);
        return;
      }

      // Get product details for context
      const productNames = group.items?.map(item => item.product.name).join(", ") || "Multiple products";

      const notification: NotificationTemplate = {
        type: "request_accepted",
        title: "Request Accepted! 🎉",
        message: `Your request to join group "${group.name}" for ${productNames} has been accepted by the group owner.`,
        priority: "normal",
        data: {
          userId: memberId,
          groupId,
          groupName: group.name,
          productName: productNames,
          memberName: `${member.firstName} ${member.lastName}`
        }
      };

      await this.createNotification(memberId, notification);
      console.log(`Request accepted notification sent to member ${memberId} for group ${groupId}`);
    } catch (error) {
      console.error("Error sending request accepted notification:", error);
    }
  }

  /**
   * Scenario 3: Payment done and order created
   * Notify all members in the group when payment is completed and order is created
   */
  async notifyOrderCreatedForGroupMembers(orderId: number, groupId: number): Promise<void> {
    try {
      // Get order details
      const order = await storage.getOrder(orderId);
      if (!order) {
        console.error(`Order ${orderId} not found for order created notification`);
        return;
      }

      // Get group details
      const group = await storage.getUserGroup(groupId);
      if (!group) {
        console.error(`Group ${groupId} not found for order created notification`);
        return;
      }

      // Get all approved members in the group
      const members = await storage.getApprovedParticipants(groupId);
      if (!members || members.length === 0) {
        console.error(`No approved members found for group ${groupId}`);
        return;
      }

      // Get product details
      const orderItemsList = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      const productNames = orderItemsList.map(item => item.productId).join(", ");

      // Notify all group members
      for (const member of members) {
        const notification: NotificationTemplate = {
          type: "order_created",
          title: "Order Created! 📦",
          message: `An order has been created for your group "${group.name}" with products: ${productNames}. Payment has been completed successfully.`,
          priority: "normal",
          data: {
            userId: member.userId,
            groupId,
            orderId,
            groupName: group.name,
            productName: productNames,
            totalAmount: order.totalPrice,
            memberName: `${member.user.firstName} ${member.user.lastName}`
          }
        };

        await this.createNotification(member.userId, notification);
      }

      console.log(`Order created notifications sent to ${members.length} members for group ${groupId}`);
    } catch (error) {
      console.error("Error sending order created notifications:", error);
    }
  }

  /**
   * Scenario 4: Order status changed
   * Notify the specific member when their order status is updated
   */
  async notifyOrderStatusChanged(userId: string, orderId: number, newStatus: string): Promise<void> {
    try {
      // Get order details
      const order = await storage.getOrder(orderId);
      if (!order) {
        console.error(`Order ${orderId} not found for status change notification`);
        return;
      }

      // Get user details
      const user = await storage.getUser(userId);
      if (!user) {
        console.error(`User ${userId} not found for status change notification`);
        return;
      }

      // Get product details
      const orderItemsList = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      const productNames = orderItemsList.map(item => item.productId).join(", ");

      const statusMessages = {
        pending: "Your order is being processed",
        processing: "Your order is being prepared",
        shipped: "Your order has been shipped",
        delivered: "Your order has been delivered",
        completed: "Your order has been completed",
        cancelled: "Your order has been cancelled"
      };

      const statusEmojis = {
        pending: "⏳",
        processing: "🔄",
        shipped: "🚚",
        delivered: "📦",
        completed: "✅",
        cancelled: "❌"
      };

      const notification: NotificationTemplate = {
        type: "order_status_change",
        title: `Order Status Updated ${statusEmojis[newStatus as keyof typeof statusEmojis] || "📋"}`,
        message: `${statusMessages[newStatus as keyof typeof statusMessages] || "Your order status has been updated"} for products: ${productNames}.`,
        priority: "normal",
        data: {
          userId,
          orderId,
          orderStatus: newStatus,
          productName: productNames,
          totalAmount: order.totalPrice,
          memberName: `${user.firstName} ${user.lastName}`
        }
      };

      await this.createNotification(userId, notification);
      console.log(`Order status change notification sent to user ${userId} for order ${orderId}`);
    } catch (error) {
      console.error("Error sending order status change notification:", error);
    }
  }

  /**
   * Scenario 5: Order created (Seller perspective)
   * Notify the seller when an order is created for their products
   */
  async notifySellerOrderCreated(orderId: number): Promise<void> {
    try {
      // Get order details
      const order = await storage.getOrder(orderId);
      if (!order) {
        console.error(`Order ${orderId} not found for seller notification`);
        return;
      }

      // Get order items to find all sellers
      const orderItemsList = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      // Get unique sellers from order items
      const sellerIds = new Set<string>();
      const sellerProducts = new Map<string, string[]>();

      for (const item of orderItemsList) {
        const product = await storage.getProduct(item.productId);
        if (product && product.sellerId) {
          sellerIds.add(product.sellerId);
          if (!sellerProducts.has(product.sellerId)) {
            sellerProducts.set(product.sellerId, []);
          }
          sellerProducts.get(product.sellerId)!.push(product.name);
        }
      }

      // Notify each seller
      for (const sellerId of Array.from(sellerIds)) {
        const seller = await storage.getUser(sellerId);
        if (!seller) {
          console.error(`Seller ${sellerId} not found for order notification`);
          continue;
        }

        const productNames = sellerProducts.get(sellerId)?.join(", ") || "Unknown products";

        const notification: NotificationTemplate = {
          type: "new_order",
          title: "New Order Received! 🛒",
          message: `You have received a new order for products: ${productNames}. Order total: $${order.totalPrice}`,
          priority: "high",
          data: {
            sellerId,
            orderId,
            productName: productNames,
            totalAmount: order.totalPrice,
            orderType: order.type,
            sellerName: `${seller.firstName} ${seller.lastName}`
          }
        };

        await this.createNotification(sellerId, notification);
      }

      console.log(`Order created notifications sent to ${sellerIds.size} sellers for order ${orderId}`);
    } catch (error) {
      console.error("Error sending seller order notifications:", error);
    }
  }

  /**
   * Helper method to create notifications
   * Uses the existing sellerNotifications table for all notifications
   */
  private async createNotification(userId: string, notification: NotificationTemplate): Promise<void> {
    await storage.createSellerNotification({
      sellerId: userId, // Using userId as sellerId for all notifications
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      priority: notification.priority
    });
  }
}

export const notificationService = new NotificationService();
