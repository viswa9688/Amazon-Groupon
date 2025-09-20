import { storage } from "./storage";
import { db } from "./db";
import { eq, and, gte, lte } from "drizzle-orm";
import { 
  users, 
  products, 
  userGroups, 
  userGroupParticipants, 
  groupPayments, 
  orders,
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
  deadline?: Date;
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
   * S1: User Request to Join Group
   * Notify the group owner when a user sends a request to join their group
   */
  async notifyGroupJoinRequest(userId: string, groupId: number): Promise<void> {
    try {
      // Get group details
      const group = await storage.getUserGroup(groupId);
      if (!group) {
        console.error(`Group ${groupId} not found for join request notification`);
        return;
      }

      // Get user details
      const user = await storage.getUser(userId);
      if (!user) {
        console.error(`User ${userId} not found for join request notification`);
        return;
      }

      // Get product details for context
      const productNames = group.items?.map(item => item.product.name).join(", ") || "Multiple products";

      const notification: NotificationTemplate = {
        type: "group_join_request",
        title: "New Join Request",
        message: `${user.firstName} ${user.lastName} wants to join your group "${group.name}" for ${productNames}.`,
        priority: "normal",
        data: {
          userId,
          groupId,
          groupName: group.name,
          productName: productNames,
          requesterName: `${user.firstName} ${user.lastName}`,
          requesterEmail: user.email
        }
      };

      await this.createSellerNotification(group.userId, notification);
      console.log(`Join request notification sent to group owner ${group.userId} for group ${groupId}`);
    } catch (error) {
      console.error("Error sending group join request notification:", error);
    }
  }

  /**
   * S2: Group Filled
   * Notify the group owner when the group reaches its maximum number of members
   */
  async notifyGroupFilled(groupId: number): Promise<void> {
    try {
      // Get group details
      const group = await storage.getUserGroup(groupId);
      if (!group) {
        console.error(`Group ${groupId} not found for group filled notification`);
        return;
      }

      // Get participant count
      const participantCount = await storage.getUserGroupParticipantCount(groupId);
      
      // Get product details for context
      const productNames = group.items?.map(item => item.product.name).join(", ") || "Multiple products";

      const notification: NotificationTemplate = {
        type: "group_filled",
        title: "Group is Full! 🎉",
        message: `Your group "${group.name}" for ${productNames} is now full with ${participantCount} members. You can now proceed with payments and orders.`,
        priority: "high",
        data: {
          groupId,
          groupName: group.name,
          productName: productNames,
          participantCount,
          maxParticipants: 5 // Based on current system limit
        }
      };

      await this.createSellerNotification(group.userId, notification);
      console.log(`Group filled notification sent to group owner ${group.userId} for group ${groupId}`);
    } catch (error) {
      console.error("Error sending group filled notification:", error);
    }
  }

  /**
   * S3: Payment Made
   * Notify both the user who made the payment and the group owner when a payment is completed
   */
  async notifyPaymentMade(paymentId: number): Promise<void> {
    try {
      // Get payment details
      const payment = await storage.getGroupPayment(paymentId);
      if (!payment) {
        console.error(`Payment ${paymentId} not found for payment notification`);
        return;
      }

      // Get group details
      const group = await storage.getUserGroup(payment.userGroupId);
      if (!group) {
        console.error(`Group ${payment.userGroupId} not found for payment notification`);
        return;
      }

      // Get product details
      const product = await db.select().from(products).where(eq(products.id, payment.productId)).limit(1);
      const productName = product[0]?.name || "Unknown Product";

      // Get beneficiary details (who the payment is for)
      const beneficiary = await storage.getUser(payment.userId);
      if (!beneficiary) {
        console.error(`Beneficiary ${payment.userId} not found for payment notification`);
        return;
      }

      // Get payer details (who made the payment)
      const payer = await storage.getUser(payment.payerId);
      if (!payer) {
        console.error(`Payer ${payment.payerId} not found for payment notification`);
        return;
      }

      // Notify the payer (who made the payment)
      const payerNotification: NotificationTemplate = {
        type: "payment_completed",
        title: "Payment Successful! ✅",
        message: `Your payment of $${payment.amount} for ${productName} in group "${group.name}" has been processed successfully.`,
        priority: "normal",
        data: {
          userId: payment.userId, // Beneficiary
          payerId: payment.payerId, // Payer
          groupId: payment.userGroupId,
          productId: payment.productId,
          orderId: payment.id,
          paymentId,
          amount: payment.amount,
          groupName: group.name,
          productName,
          beneficiaryName: `${beneficiary.firstName} ${beneficiary.lastName}`,
          payerName: `${payer.firstName} ${payer.lastName}`
        }
      };

      await this.createUserNotification(payment.payerId, payerNotification);

      // Notify the beneficiary (who the payment is for) if they're different from the payer
      if (payment.userId !== payment.payerId) {
        const beneficiaryNotification: NotificationTemplate = {
          type: "payment_received",
          title: "Payment Received! 💰",
          message: `${payer.firstName} ${payer.lastName} has paid $${payment.amount} for ${productName} in group "${group.name}" on your behalf.`,
          priority: "normal",
          data: {
            userId: payment.userId, // Beneficiary
            payerId: payment.payerId, // Payer
            groupId: payment.userGroupId,
            productId: payment.productId,
            orderId: payment.id,
            paymentId,
            amount: payment.amount,
            groupName: group.name,
            productName,
            beneficiaryName: `${beneficiary.firstName} ${beneficiary.lastName}`,
            payerName: `${payer.firstName} ${payer.lastName}`
          }
        };

        await this.createUserNotification(payment.userId, beneficiaryNotification);
      }

      // Notify the product seller (not the group owner)
      const productSellerId = product[0]?.sellerId;
      if (productSellerId) {
        const sellerNotification: NotificationTemplate = {
          type: "payment_received",
          title: "Payment Received 💰",
          message: `${payer.firstName} ${payer.lastName} has completed a payment of $${payment.amount} for ${productName} in group "${group.name}".`,
          priority: "normal",
          data: {
            userId: payment.userId, // Beneficiary
            payerId: payment.payerId, // Payer
            sellerId: productSellerId,
            groupId: payment.userGroupId,
            productId: payment.productId,
            paymentId,
            amount: payment.amount,
            groupName: group.name,
            productName,
            payerName: `${payer.firstName} ${payer.lastName}`,
            payerEmail: payer.email,
            beneficiaryName: `${beneficiary.firstName} ${beneficiary.lastName}`,
            beneficiaryEmail: beneficiary.email
          }
        };

        await this.createSellerNotification(productSellerId, sellerNotification);
      } else {
        console.error(`Product seller not found for product ${payment.productId}`);
      }

      // Update shipping status to "Payment Completed"
      await this.updateOrderShippingStatus(payment.userId, payment.userGroupId, payment.productId, "Payment Completed");
    } catch (error) {
      console.error("Error sending payment notifications:", error);
    }
  }

  /**
   * S4: Product Delivered
   * Notify the user when the product is delivered
   */
  async notifyProductDelivered(userId: string, groupId: number, productId: number): Promise<void> {
    try {
      // Get group details
      const group = await storage.getUserGroup(groupId);
      if (!group) {
        console.error(`Group ${groupId} not found for delivery notification`);
        return;
      }

      // Get product details
      const product = await db.select().from(products).where(eq(products.id, productId)).limit(1);
      const productName = product[0]?.name || "Unknown Product";

      const notification: NotificationTemplate = {
        type: "product_delivered",
        title: "Package Delivered! 📦",
        message: `Great news! Your ${productName} from group "${group.name}" has been delivered. Enjoy your purchase!`,
        priority: "normal",
        data: {
          userId,
          groupId,
          productId,
          groupName: group.name,
          productName,
          deliveryDate: new Date().toISOString()
        }
      };

      await this.createUserNotification(userId, notification);

      // Update shipping status to "Delivered"
      await this.updateOrderShippingStatus(userId, groupId, productId, "Delivered");

      console.log(`Delivery notification sent to user ${userId} for product ${productId}`);
    } catch (error) {
      console.error("Error sending delivery notification:", error);
    }
  }

  /**
   * S5: Discount Timeline Expired
   * Notify users when the discount period has ended
   */
  async notifyDiscountExpired(groupId: number): Promise<void> {
    try {
      // Get group details
      const group = await storage.getUserGroup(groupId);
      if (!group) {
        console.error(`Group ${groupId} not found for discount expiration notification`);
        return;
      }

      // Get all participants
      const participants = await db
        .select()
        .from(userGroupParticipants)
        .where(eq(userGroupParticipants.userGroupId, groupId));

      // Get product details for context
      const productNames = group.items?.map(item => item.product.name).join(", ") || "Multiple products";

      // Notify all participants
      for (const participant of participants) {
        const notification: NotificationTemplate = {
          type: "discount_expired",
          title: "Discount Period Ended ⏰",
          message: `The discount period for your group "${group.name}" (${productNames}) has ended. Please complete your payment soon to secure your order.`,
          priority: "high",
          data: {
            userId: participant.userId,
            groupId,
            groupName: group.name,
            productName: productNames,
            expirationDate: new Date().toISOString()
          }
        };

        await this.createUserNotification(participant.userId, notification);
      }

      console.log(`Discount expiration notifications sent to ${participants.length} participants for group ${groupId}`);
    } catch (error) {
      console.error("Error sending discount expiration notifications:", error);
    }
  }

  /**
   * S6: Payment Deadline Expired
   * Notify users when the payment deadline has passed
   */
  async notifyPaymentDeadlineExpired(groupId: number): Promise<void> {
    try {
      // Get group details
      const group = await storage.getUserGroup(groupId);
      if (!group) {
        console.error(`Group ${groupId} not found for payment deadline notification`);
        return;
      }

      // Get participants who haven't paid
      const unpaidParticipants = await this.getUnpaidParticipants(groupId);

      // Get product details for context
      const productNames = group.items?.map(item => item.product.name).join(", ") || "Multiple products";

      // Notify unpaid participants
      for (const participant of unpaidParticipants) {
        const notification: NotificationTemplate = {
          type: "payment_deadline_expired",
          title: "Payment Deadline Passed ⚠️",
          message: `The payment deadline for your group "${group.name}" (${productNames}) has passed. Your order may be cancelled if payment is not completed soon. Please contact support for assistance.`,
          priority: "urgent",
          data: {
            userId: participant.userId,
            groupId,
            groupName: group.name,
            productName: productNames,
            deadlineDate: new Date().toISOString(),
            nextSteps: "Contact support or complete payment immediately"
          }
        };

        await this.createUserNotification(participant.userId, notification);
      }

      console.log(`Payment deadline notifications sent to ${unpaidParticipants.length} participants for group ${groupId}`);
    } catch (error) {
      console.error("Error sending payment deadline notifications:", error);
    }
  }

  /**
   * Helper method to create seller notifications
   */
  private async createSellerNotification(sellerId: string, notification: NotificationTemplate): Promise<void> {
    await storage.createSellerNotification({
      sellerId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      priority: notification.priority
    });
  }

  /**
   * Helper method to create user notifications
   * Note: Currently using sellerNotifications table for user notifications too
   * In a production system, you might want a separate userNotifications table
   */
  private async createUserNotification(userId: string, notification: NotificationTemplate): Promise<void> {
    await storage.createSellerNotification({
      sellerId: userId, // Using userId as sellerId for user notifications
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      priority: notification.priority
    });
  }

  /**
   * Helper method to update order shipping status
   */
  private async updateOrderShippingStatus(userId: string, groupId: number, productId: number, status: string): Promise<void> {
    try {
      // Find the order for this user, group, and product
      const order = await db
        .select()
        .from(orders)
        .where(and(
          eq(orders.userId, userId),
          eq(orders.productId, productId)
        ))
        .limit(1);

      if (order[0]) {
        await storage.updateOrderStatus(order[0].id, status);
        console.log(`Updated order ${order[0].id} shipping status to: ${status}`);
      }
    } catch (error) {
      console.error("Error updating order shipping status:", error);
    }
  }

  /**
   * Helper method to get participants who haven't paid
   */
  private async getUnpaidParticipants(groupId: number): Promise<{ userId: string }[]> {
    try {
      // Get all participants
      const allParticipants = await db
        .select()
        .from(userGroupParticipants)
        .where(eq(userGroupParticipants.userGroupId, groupId));

      // Get all paid participants
      const paidParticipants = await db
        .select({ userId: groupPayments.userId })
        .from(groupPayments)
        .where(and(
          eq(groupPayments.userGroupId, groupId),
          eq(groupPayments.status, "succeeded")
        ));

      const paidUserIds = new Set(paidParticipants.map(p => p.userId));

      // Return participants who haven't paid
      return allParticipants.filter(p => !paidUserIds.has(p.userId));
    } catch (error) {
      console.error("Error getting unpaid participants:", error);
      return [];
    }
  }

  /**
   * Batch method to check and send notifications for expired discounts and payment deadlines
   * This should be called periodically (e.g., via cron job)
   */
  async processExpiredNotifications(): Promise<void> {
    try {
      console.log("Processing expired notifications...");

      // Get all active groups
      const activeGroups = await db
        .select()
        .from(userGroups)
        .where(eq(userGroups.isPublic, true));

      const now = new Date();

      for (const group of activeGroups) {
        // Check if discount period has expired
        if (group.offerValidTill && group.offerValidTill < now) {
          await this.notifyDiscountExpired(group.id);
        }

        // Check if payment deadline has expired (assuming 7 days after discount expires)
        const paymentDeadline = group.offerValidTill ? new Date(group.offerValidTill.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
        if (paymentDeadline && paymentDeadline < now) {
          await this.notifyPaymentDeadlineExpired(group.id);
        }
      }

      console.log("Expired notifications processing completed");
    } catch (error) {
      console.error("Error processing expired notifications:", error);
    }
  }
}

export const notificationService = new NotificationService();
