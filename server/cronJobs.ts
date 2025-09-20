import { notificationService } from "./notificationService";

/**
 * Cron job functions for processing notifications
 * These should be called periodically (e.g., every hour or daily)
 */

export async function processExpiredNotifications() {
  try {
    console.log("Starting expired notifications processing...");
    await notificationService.processExpiredNotifications();
    console.log("Expired notifications processing completed");
  } catch (error) {
    console.error("Error in expired notifications cron job:", error);
  }
}

// Always run the function when this script is executed
processExpiredNotifications()
  .then(() => {
    console.log("Cron job completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Cron job failed:", error);
    process.exit(1);
  });
