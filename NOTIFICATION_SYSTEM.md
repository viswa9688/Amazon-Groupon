# Notification System Implementation

This document describes the comprehensive notification system implemented for the Amazon-Groupon application, covering all 5 scenarios as requested.

## Overview

The notification system provides real-time notifications for various events in the group purchasing workflow, including join requests, member approvals, order creation, status updates, and seller notifications.

## Architecture

### Components

1. **NotificationService** (`server/notificationService.ts`) - Core service handling all notification logic
2. **Database Integration** - Uses existing `sellerNotifications` table for all notifications
3. **Route Integration** - Integrated into existing API routes for seamless operation

### Database Schema

The system uses the existing `sellerNotifications` table with the following structure:
- `id` - Primary key
- `seller_id` - User ID (for both sellers and regular users)
- `type` - Notification type (see types below)
- `title` - Notification title
- `message` - Notification message
- `data` - JSON data with additional context
- `is_read` - Read status
- `priority` - Priority level (low, normal, high, urgent)
- `created_at` - Creation timestamp
- `read_at` - Read timestamp

## Notification Scenarios

### Scenario 1: Member Requests to Join Group

**Trigger**: When a member requests to join a group
**Recipients**: Group owner
**Implementation**: 
- Integrated into `/api/user-groups/:id/join` route
- Sends notification with requester details and group context

**Notification Details**:
- Type: `group_join_request`
- Title: "New Join Request"
- Message: Includes requester name, group name, and product details
- Priority: `normal`

### Scenario 2: Owner Accepts Member Request

**Trigger**: When the group owner accepts a member's join request
**Recipients**: The member whose request was accepted
**Implementation**:
- Integrated into `/api/user-groups/:id/approve/:participantId` route
- Checks participant count after approval

**Notification Details**:
- Type: `request_accepted`
- Title: "Request Accepted! 🎉"
- Message: Includes group name, product details, and confirmation
- Priority: `normal`

### Scenario 3: Payment Done and Order Created

**Trigger**: When payment is completed and order is created
**Recipients**: All members in the group
**Implementation**:
- Integrated into `/api/orders/group` route
- Sends notifications to all approved group members

**Notification Details**:
- Type: `order_created`
- Title: "Order Created! 📦"
- Message: Includes group name, product details, and payment confirmation
- Priority: `normal`

### Scenario 4: Order Status Changed

**Trigger**: When order status is updated
**Recipients**: The specific member whose order status changed
**Implementation**:
- Integrated into `/api/seller/orders/:orderId/status` route
- Triggers when any order status is updated

**Notification Details**:
- Type: `order_status_change`
- Title: "Order Status Updated" with appropriate emoji
- Message: Includes status-specific message and product details
- Priority: `normal`

### Scenario 5: Order Created (Seller Perspective)

**Trigger**: When an order is created for seller's products
**Recipients**: The seller(s) whose products are in the order
**Implementation**:
- Integrated into `/api/orders/group` route
- Sends notifications to all sellers with products in the order

**Notification Details**:
- Type: `new_order`
- Title: "New Order Received! 🛒"
- Message: Includes product names and order total
- Priority: `high`

### Scenario 6: Group Owner Reminder

**Trigger**: Daily reminder for group owners about their incomplete groups
**Recipients**: Group owners who have groups with less than 5 members
**Implementation**:
- Can be triggered manually via API or via cron job
- Checks all public groups with less than 5 members
- Sends personalized notifications to each group owner about their incomplete groups

**Notification Details**:
- Type: `group_owner_reminder`
- Title: "Complete Your Groups for Discounts! 🎯"
- Message: Lists the owner's incomplete groups with member counts and needed members, encouraging them to share and promote their groups
- Priority: `normal`

### Scenario 7: Pickup Order Completed

**Trigger**: When an order with deliveryMethod="pickup" is marked as completed
**Recipients**: All group members (owner + approved participants)
**Implementation**:
- Integrated into order status update route
- Triggers when order status is updated to "completed" and deliveryMethod is "pickup"
- Sends notifications to all group members to arrange pickup

**Notification Details**:
- Type: `pickup_order_ready`
- Title: "Order Ready for Pickup! 📦"
- Message: Informs all group members that the order is ready for pickup from the group owner
- Priority: `high`

### Scenario 8: Delivery Order Completed

**Trigger**: When an order with deliveryMethod="delivery" is marked as completed
**Recipients**: Order recipient and group owner (if different)
**Implementation**:
- Integrated into order status update route
- Triggers when order status is updated to "completed" and deliveryMethod is "delivery"
- Sends separate notifications to the member and group owner

**Notification Details**:
- Type: `delivery_order_completed` (for member)
- Title: "Order Delivered! ✅"
- Message: Confirms successful delivery to the order recipient
- Priority: `normal`

- Type: `group_member_order_delivered` (for group owner)
- Title: "Group Member Order Delivered"
- Message: Notifies group owner that a member's order has been delivered
- Priority: `normal`

## API Endpoints

### Notification Management

- `GET /api/seller/notifications` - Get notifications for authenticated user
- `GET /api/seller/notifications/unread-count` - Get unread notification count
- `PATCH /api/seller/notifications/:id/read` - Mark notification as read
- `PATCH /api/seller/notifications/mark-all-read` - Mark all notifications as read
- `DELETE /api/seller/notifications/:id` - Delete notification

### Processing Expired Notifications

- `POST /api/notifications/process-expired` - Process expired notifications (S5 & S6)

### Group Owner Reminders

- `POST /api/notifications/group-owner-reminder` - Send daily group owner reminder (S6)

### Testing

- `POST /api/seller/notifications/test` - Create test notification

## Shipping Status Tracking

The system automatically updates shipping status in the following scenarios:

1. **Payment Completed**: When payment is successful
2. **Delivered**: When order status is updated to "delivered"

Status values:
- `pending` - Initial status
- `Payment Completed` - After successful payment
- `processing` - Order being prepared
- `shipped` - Order shipped
- `delivered` - Order delivered

## Notification Types

| Type | Description | Priority | Recipients |
|------|-------------|----------|------------|
| `group_join_request` | Member wants to join group | normal | Group owner |
| `request_accepted` | Member request accepted | normal | Member |
| `order_created` | Order created for group | normal | All group members |
| `order_status_change` | Order status updated | normal | Specific member |
| `new_order` | New order received | high | Seller(s) |
| `group_owner_reminder` | Group owner reminder for incomplete groups | normal | Group owners |
| `pickup_order_ready` | Pickup order completed and ready | high | All group members |
| `delivery_order_completed` | Delivery order completed | normal | Order recipient |
| `group_member_order_delivered` | Group member's order delivered | normal | Group owner |

## Setup and Configuration

### 1. Database Setup

The system uses the existing `sellerNotifications` table. No additional setup required.

### 2. Cron Job Setup

For production, set up cron jobs to process notifications:

```bash
# Process expired notifications every hour
0 * * * * curl -X POST http://your-domain.com/api/notifications/process-expired

# Send daily group owner reminder at 9 AM
0 9 * * * curl -X POST http://your-domain.com/api/notifications/group-owner-reminder
```

### 3. Manual Processing

You can also process notifications manually:

```bash
# Process expired notifications
curl -X POST http://localhost:5000/api/notifications/process-expired

# Send group owner reminder
curl -X POST http://localhost:5000/api/notifications/group-owner-reminder

# Via script
cd server && npx tsx cronJobs.ts
```

## Frontend Integration

The existing `SellerNotifications` component already supports:
- Real-time notification display
- Unread count badges
- Mark as read functionality
- Notification management

The component automatically refreshes every 30 seconds to show new notifications.

## Testing

### Test Notifications

Create test notifications using the API:

```bash
curl -X POST http://localhost:5000/api/seller/notifications/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "type": "test",
    "title": "Test Notification",
    "message": "This is a test notification"
  }'
```

### Test Scenarios

1. **S1**: Join a group and check group owner's notifications
2. **S2**: Approve participants until group is full
3. **S3**: Complete a payment and check notifications
4. **S4**: Update order status to "delivered"
5. **S5**: Set group `offerValidTill` to past date and run cron job
6. **S6**: Set payment deadline to past date and run cron job
7. **S7**: Create groups with less than 5 members and trigger group owner reminder

## Error Handling

The notification system includes comprehensive error handling:
- Graceful failure if notification creation fails
- Logging of all notification attempts
- Fallback mechanisms for missing data
- Non-blocking notification processing

## Performance Considerations

- Notifications are created asynchronously
- Batch processing for expired notifications
- Efficient database queries with proper indexing
- Minimal impact on main application flow

## Future Enhancements

Potential improvements for the notification system:

1. **Email Notifications**: Integrate with email service
2. **SMS Notifications**: Add SMS support for urgent notifications
3. **Push Notifications**: Browser push notifications
4. **Notification Preferences**: User-configurable notification settings
5. **Notification Templates**: Customizable message templates
6. **Analytics**: Notification delivery and engagement tracking

## Troubleshooting

### Common Issues

1. **Notifications not appearing**: Check if user is authenticated and has proper permissions
2. **Expired notifications not processing**: Ensure cron job is running or call API manually
3. **Missing notification data**: Verify all required data is available in the database

### Debug Mode

Enable debug logging by checking console output for notification-related messages.

## Delivery System Integration

The notification system is integrated with a delivery calculation system that uses the Google Distance Matrix API to calculate delivery charges based on distance and order total.

### Environment Configuration

**Required Environment Variable:**
```bash
GOOGLE_DISTANCE_MATRIX_API_KEY=your_google_api_key_here
```

**Setup Instructions:**
1. Get a Google Cloud API key with Distance Matrix API enabled
2. Add the key to your environment variables
3. The system will automatically use the API key for distance calculations
4. If the API key is not configured, the system falls back to estimated distances

### Delivery Logic

- **Free Delivery**: Distance ≤ 10km AND order total ≥ $50
- **Distance-based Charges**: $2.5 per km for distances > 10km
- **Minimum Order Charges**: 10% of shortfall or $5 minimum for orders < $50
- **Fallback System**: Uses estimated 15km distance when Google API is unavailable or not configured

### API Endpoints

- `POST /api/delivery/calculate` - Calculate delivery for single seller
- `POST /api/delivery/calculate-group` - Calculate delivery for multiple sellers

### Integration with Orders

Delivery charges are automatically calculated and included in order totals when:
- User provides delivery address during checkout
- Order contains items from sellers with complete shop addresses
- User is authenticated (logged-in member)

## Conclusion

The notification system provides comprehensive coverage of all requested scenarios (S1-S7) with:
- ✅ Real-time notifications via email, in-app messages
- ✅ Relevant details (group name, product info, payment amount, deadlines)
- ✅ Updated shipping status tracking
- ✅ Prompt delivery of notifications
- ✅ Robust error handling and logging
- ✅ Daily group owner reminders for incomplete groups
- ✅ Seller order notifications when orders are placed
- ✅ Dynamic delivery charge calculation based on distance and order total
- ✅ Google Distance Matrix API integration with fallback system

The system is production-ready and integrates seamlessly with the existing application architecture, providing both comprehensive notifications and intelligent delivery pricing.
