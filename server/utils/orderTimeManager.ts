/**
 * Order Time Management Utility
 * Handles delivery date calculations based on order time
 */

export interface DeliveryDateInfo {
  expectedDeliveryDate: Date;
  isNextDay: boolean;
  orderTime: Date;
  cutoffTime: string;
}

/**
 * Calculate expected delivery date based on order time
 * Orders made after 12:00 PM will be delivered the next day
 * Orders made before 12:00 PM will be delivered the same day
 */
export function calculateExpectedDeliveryDate(orderTime: Date = new Date()): DeliveryDateInfo {
  const cutoffHour = 12; // 12:00 PM cutoff
  const orderHour = orderTime.getHours();
  
  const isNextDay = orderHour >= cutoffHour;
  
  let expectedDeliveryDate: Date;
  
  if (isNextDay) {
    // Order made after 12:00 PM - deliver next day
    expectedDeliveryDate = new Date(orderTime);
    expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + 1);
  } else {
    // Order made before 12:00 PM - deliver same day
    expectedDeliveryDate = new Date(orderTime);
  }
  
  // Set delivery time to end of day (11:59 PM)
  expectedDeliveryDate.setHours(23, 59, 59, 999);
  
  return {
    expectedDeliveryDate,
    isNextDay,
    orderTime,
    cutoffTime: `${cutoffHour}:00 PM`
  };
}

/**
 * Format delivery date for display
 */
export function formatDeliveryDate(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const isToday = date.toDateString() === today.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  
  if (isToday) {
    return "Today";
  } else if (isTomorrow) {
    return "Tomorrow";
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

/**
 * Get delivery status message based on order time
 */
export function getDeliveryStatusMessage(orderTime: Date = new Date()): string {
  const deliveryInfo = calculateExpectedDeliveryDate(orderTime);
  const formattedDate = formatDeliveryDate(deliveryInfo.expectedDeliveryDate);
  
  if (deliveryInfo.isNextDay) {
    return `Order placed after ${deliveryInfo.cutoffTime}. Expected delivery: ${formattedDate}`;
  } else {
    return `Order placed before ${deliveryInfo.cutoffTime}. Expected delivery: ${formattedDate}`;
  }
}

/**
 * Check if an order is eligible for same-day delivery
 */
export function isEligibleForSameDayDelivery(orderTime: Date = new Date()): boolean {
  const cutoffHour = 12;
  return orderTime.getHours() < cutoffHour;
}

/**
 * Get time until cutoff for same-day delivery
 */
export function getTimeUntilCutoff(): { hours: number; minutes: number; message: string } {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(12, 0, 0, 0); // 12:00 PM
  
  // If it's already past cutoff today, show cutoff for tomorrow
  if (now >= cutoff) {
    cutoff.setDate(cutoff.getDate() + 1);
  }
  
  const diffMs = cutoff.getTime() - now.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  let message = "";
  if (hours > 0) {
    message = `${hours}h ${minutes}m left for same-day delivery`;
  } else if (minutes > 0) {
    message = `${minutes}m left for same-day delivery`;
  } else {
    message = "Same-day delivery cutoff passed";
  }
  
  return { hours, minutes, message };
}
