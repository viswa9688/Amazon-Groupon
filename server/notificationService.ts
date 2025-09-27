import { storage } from "./storage";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
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
import { websocketNotificationBroadcaster } from "./websocketNotificationBroadcaster";

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
        out_for_delivery: "Your order is out for delivery",
        delivered: "Your order has been delivered",
        completed: "Your order has been completed",
        cancelled: "Your order has been cancelled"
      };

      const statusEmojis = {
        pending: "⏳",
        processing: "🔄",
        shipped: "🚚",
        out_for_delivery: "🚛",
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
   * New Notification: Group Owner Reminder
   * Notify group owners about their incomplete groups that need more members
   */
  async notifyGroupOwnersIncompleteGroups(): Promise<void> {
    try {
      // Get all groups that are incomplete (less than 5 members)
      const incompleteGroups = await this.getIncompleteGroups();
      
      if (incompleteGroups.length === 0) {
        console.log("No incomplete groups found for group owner notifications");
        return;
      }

      // Group incomplete groups by owner
      const groupsByOwner = new Map<string, Array<{
        id: number;
        name: string;
        currentMembers: number;
        neededMembers: number;
      }>>();

      for (const group of incompleteGroups) {
        const ownerId = group.ownerId;
        if (!groupsByOwner.has(ownerId)) {
          groupsByOwner.set(ownerId, []);
        }
        groupsByOwner.get(ownerId)!.push({
          id: group.id,
          name: group.name,
          currentMembers: group.currentMembers,
          neededMembers: 5 - group.currentMembers
        });
      }

      // Send notification to each group owner
      const ownerEntries = Array.from(groupsByOwner.entries());
      for (const [ownerId, ownerGroups] of ownerEntries) {
        const groupDetails = ownerGroups.map(group => 
          `"${group.name}" (${group.currentMembers}/5 members) - needs ${group.neededMembers} more`
        ).join('\n');

        const notification: NotificationTemplate = {
          type: "group_owner_reminder",
          title: "Complete Your Groups for Discounts! 🎯",
          message: `You have ${ownerGroups.length} group${ownerGroups.length > 1 ? 's' : ''} that need more members to unlock discounts:\n\n${groupDetails}\n\nShare your groups with friends or promote them to reach the 5-member threshold and activate group discounts!`,
          priority: "normal",
          data: {
            userId: ownerId,
            incompleteGroupsCount: ownerGroups.length,
            groups: ownerGroups
          }
        };

        await this.createNotification(ownerId, notification);
        console.log(`Group owner reminder sent to ${ownerId} for ${ownerGroups.length} incomplete groups`);
      }

      console.log(`Group owner reminders sent to ${groupsByOwner.size} owners for ${incompleteGroups.length} incomplete groups`);
    } catch (error) {
      console.error("Error sending group owner reminders:", error);
    }
  }

  /**
   * Helper method to get incomplete groups (less than 5 members)
   */
  private async getIncompleteGroups(): Promise<Array<{
    id: number;
    name: string;
    currentMembers: number;
    ownerId: string;
    ownerName: string;
  }>> {
    try {
      // Get all user groups with their participant counts
      const groups = await db
        .select({
          id: userGroups.id,
          name: userGroups.name,
          userId: userGroups.userId,
          userFirstName: users.firstName,
          userLastName: users.lastName
        })
        .from(userGroups)
        .leftJoin(users, eq(userGroups.userId, users.id))
        .where(eq(userGroups.isPublic, true)); // Only public groups

      const incompleteGroups = [];

      for (const group of groups) {
        // Count approved participants for this group
        const participantCount = await storage.getUserGroupParticipantCount(group.id);
        
        if (participantCount < 5) {
          incompleteGroups.push({
            id: group.id,
            name: group.name,
            currentMembers: participantCount,
            ownerId: group.userId,
            ownerName: `${group.userFirstName || 'Unknown'} ${group.userLastName || ''}`.trim()
          });
        }
      }

      return incompleteGroups;
    } catch (error) {
      console.error("Error getting incomplete groups:", error);
      return [];
    }
  }

  /**
   * Process expired notifications (S5 & S6)
   * This method handles notifications for expired groups and payment deadlines
   * Note: Currently simplified as the database schema doesn't include expiration fields
   */
  async processExpiredNotifications(): Promise<void> {
    try {
      console.log("Processing expired notifications...");
      
      // TODO: Implement expired notifications when expiration fields are added to schema
      // For now, this is a placeholder that logs the processing
      
      console.log("Expired notifications processing completed. No expired items found.");
    } catch (error) {
      console.error("Error processing expired notifications:", error);
      throw error;
    }
  }

  /**
   * Public method to create test notifications
   */
  async createTestNotification(userId: string, message: string = "Test notification"): Promise<void> {
    const notification: NotificationTemplate = {
      type: "test_notification",
      title: "Test Notification! 🧪",
      message: message,
      priority: "normal",
      data: {
        userId: userId,
        testData: "This is test data",
        timestamp: new Date().toISOString()
      }
    };

    await this.createNotification(userId, notification);
  }

  /**
   * Helper method to create notifications
   * Uses the existing sellerNotifications table for all notifications
   */
  private async createNotification(userId: string, notification: NotificationTemplate): Promise<void> {
    // Create the notification in the database
    const createdNotification = await storage.createSellerNotification({
      sellerId: userId, // Using userId as sellerId for all notifications
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      priority: notification.priority
    });

    // Broadcast the notification in real-time to connected clients
    websocketNotificationBroadcaster.broadcastToUser(userId, {
      type: 'new_notification',
      data: {
        id: createdNotification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        isRead: false,
        createdAt: new Date().toISOString(),
        data: notification.data
      },
      userId: userId
    });

    console.log(`Real-time notification sent to user ${userId}: ${notification.title}`);
  }

  /**
   * Notify all group members when a pickup order is completed
   * This is called when an order with deliveryMethod="pickup" is marked as completed
   */
  async notifyPickupOrderCompleted(orderId: number): Promise<void> {
    try {
      // Get order details
      const order = await storage.getOrder(orderId);
      if (!order) {
        console.error(`Order ${orderId} not found for pickup completion notification`);
        return;
      }

      // Get group details from group payments
      const groupPayments = await db
        .select()
        .from(groupPayments)
        .where(eq(groupPayments.userId, order.userId));

      if (groupPayments.length === 0) {
        console.log(`No group payments found for order ${orderId}, skipping pickup notification`);
        return;
      }

      const userGroupId = groupPayments[0].userGroupId;
      const group = await storage.getUserGroup(userGroupId);
      if (!group) {
        console.error(`Group ${userGroupId} not found for pickup completion notification`);
        return;
      }

      // Get all group members (owner + participants)
      const allMembers = [group.userId]; // Start with owner
      
      // Add approved participants
      const participants = await db
        .select()
        .from(userGroupParticipants)
        .where(and(
          eq(userGroupParticipants.userGroupId, userGroupId),
          eq(userGroupParticipants.status, 'approved')
        ));

      for (const participant of participants) {
        allMembers.push(participant.userId);
      }

      // Get order items for product names
      const orderItemsList = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      const productNames = [];
      for (const item of orderItemsList) {
        const product = await storage.getProduct(item.productId);
        if (product) {
          productNames.push(product.name);
        }
      }

      const productNamesText = productNames.join(", ");

      // Notify all group members
      for (const memberId of allMembers) {
        const member = await storage.getUser(memberId);
        if (!member) continue;

        const notification: NotificationTemplate = {
          type: "pickup_order_ready",
          title: "Order Ready for Pickup! 📦",
          message: `Your group order for "${productNamesText}" is ready for pickup from the group owner. Please contact them to arrange pickup.`,
          priority: "high",
          data: {
            orderId: orderId,
            groupId: userGroupId,
            groupName: group.name,
            productNames: productNamesText,
            ownerId: group.userId
          }
        };

        await this.createNotification(memberId, notification);
      }

      console.log(`Pickup order completion notifications sent to ${allMembers.length} group members for order ${orderId}`);
    } catch (error) {
      console.error("Error sending pickup order completion notifications:", error);
    }
  }

  /**
   * Notify specific member and group owner when a delivery order is completed
   * This is called when an order with deliveryMethod="delivery" is marked as completed
   */
  async notifyDeliveryOrderCompleted(orderId: number): Promise<void> {
    try {
      // Get order details
      const order = await storage.getOrder(orderId);
      if (!order) {
        console.error(`Order ${orderId} not found for delivery completion notification`);
        return;
      }

      // Get group details from group payments
      const groupPayments = await db
        .select()
        .from(groupPayments)
        .where(eq(groupPayments.userId, order.userId));

      if (groupPayments.length === 0) {
        console.log(`No group payments found for order ${orderId}, skipping delivery notification`);
        return;
      }

      const userGroupId = groupPayments[0].userGroupId;
      const group = await storage.getUserGroup(userGroupId);
      if (!group) {
        console.error(`Group ${userGroupId} not found for delivery completion notification`);
        return;
      }

      // Get order items for product names
      const orderItemsList = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      const productNames = [];
      for (const item of orderItemsList) {
        const product = await storage.getProduct(item.productId);
        if (product) {
          productNames.push(product.name);
        }
      }

      const productNamesText = productNames.join(", ");

      // Notify the order recipient (member)
      const member = await storage.getUser(order.userId);
      if (member) {
        const memberNotification: NotificationTemplate = {
          type: "delivery_order_completed",
          title: "Order Delivered! ✅",
          message: `Your order for "${productNamesText}" has been delivered successfully. Thank you for your purchase!`,
          priority: "normal",
          data: {
            orderId: orderId,
            groupId: userGroupId,
            groupName: group.name,
            productNames: productNamesText
          }
        };

        await this.createNotification(order.userId, memberNotification);
      }

      // Notify the group owner (if different from member)
      if (group.userId !== order.userId) {
        const owner = await storage.getUser(group.userId);
        if (owner) {
          const ownerNotification: NotificationTemplate = {
            type: "group_member_order_delivered",
            title: "Group Member Order Delivered",
            message: `Order for "${productNamesText}" has been delivered to ${member?.firstName} ${member?.lastName} in your group "${group.name}".`,
            priority: "normal",
            data: {
              orderId: orderId,
              groupId: userGroupId,
              groupName: group.name,
              productNames: productNamesText,
              memberId: order.userId,
              memberName: `${member?.firstName} ${member?.lastName}`
            }
          };

          await this.createNotification(group.userId, ownerNotification);
        }
      }

      console.log(`Delivery order completion notifications sent for order ${orderId}`);
    } catch (error) {
      console.error("Error sending delivery order completion notifications:", error);
    }
  }
}

export const notificationService = new NotificationService();
