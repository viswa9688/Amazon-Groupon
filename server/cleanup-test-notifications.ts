#!/usr/bin/env npx tsx

/**
 * Script to clean up test notifications and create real notifications for testing
 */

import { db } from './db';
import { eq } from 'drizzle-orm';
import { sellerNotifications } from '@shared/schema';
import { notificationService } from './notificationService';

async function cleanupAndTest() {
  console.log('🧹 Cleaning up test notifications...\n');

  try {
    // Delete all test notifications
    const deleted = await db
      .delete(sellerNotifications)
      .where(eq(sellerNotifications.type, 'test'))
      .returning();

    console.log(`✅ Deleted ${deleted.length} test notifications\n`);

    // Create some real notifications for testing
    console.log('📝 Creating real notifications for testing...\n');

    // Test Scenario 1: Group join request
    console.log('Creating group join request notification...');
    await notificationService.notifyGroupJoinRequest('dc4e9f57-9bd2-489f-b8c7-8be270f6a00f', 1);
    console.log('✅ Group join request notification created\n');

    // Test Scenario 2: Request accepted
    console.log('Creating request accepted notification...');
    await notificationService.notifyMemberRequestAccepted('dc4e9f57-9bd2-489f-b8c7-8be270f6a00f', 1);
    console.log('✅ Request accepted notification created\n');

    // Test Scenario 3: Order created
    console.log('Creating order created notification...');
    await notificationService.notifyOrderCreatedForGroupMembers(1, 1);
    console.log('✅ Order created notification created\n');

    // Test Scenario 4: Order status changed
    console.log('Creating order status change notification...');
    await notificationService.notifyOrderStatusChanged('dc4e9f57-9bd2-489f-b8c7-8be270f6a00f', 1, 'shipped');
    console.log('✅ Order status change notification created\n');

    // Test Scenario 5: Seller order created
    console.log('Creating seller order notification...');
    await notificationService.notifySellerOrderCreated(1);
    console.log('✅ Seller order notification created\n');

    console.log('🎉 All real notifications created successfully!');
    console.log('\n📋 You should now see these notification types in the UI:');
    console.log('• group_join_request - "New Join Request"');
    console.log('• request_accepted - "Request Accepted! 🎉"');
    console.log('• order_created - "Order Created! 📦"');
    console.log('• order_status_change - "Order Status Updated 🚚"');
    console.log('• new_order - "New Order Received! 🛒"');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the cleanup and test
cleanupAndTest().then(() => {
  console.log('\n✨ Notification system is ready with real notifications!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
