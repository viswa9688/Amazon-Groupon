import twilio from 'twilio';

// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC5cd318143e6b8b2855ba8477c35556ec';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'f400b3698ba22c4f512d9ef424a010df';
const fromNumber = process.env.TWILIO_PHONE_NUMBER || '+19412063009';

// Initialize Twilio client
const client = twilio(accountSid, authToken);

export interface OTPResult {
  success: boolean;
  message: string;
  otp?: string;
  error?: string;
}

export class OTPService {
  /**
   * Generate a random 4-6 digit OTP
   */
  private generateOTP(): string {
    const length = Math.floor(Math.random() * 3) + 4; // 4-6 digits
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(Math.random() * (max - min + 1)) + min + '';
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // If it starts with 1 and is 11 digits, it's already formatted
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    
    // If it's 10 digits, assume US number and add +1
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    
    // If it's already in E.164 format, return as is
    if (digits.startsWith('1') && digits.length === 11) {
      return `+${digits}`;
    }
    
    // For other cases, assume it needs +1 prefix
    return `+1${digits}`;
  }

  /**
   * Send OTP via SMS using Twilio
   */
  async sendOTP(phoneNumber: string): Promise<OTPResult> {
    try {
      const otp = this.generateOTP();
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      console.log(`Sending OTP ${otp} to ${formattedPhone}`);
      console.log(`From number: ${fromNumber}`);
      
      // In development mode, check if we should use mock mode for testing
      if (process.env.NODE_ENV === 'development' && process.env.TWILIO_MOCK_MODE === 'true') {
        console.log('Using mock mode for development');
        return {
          success: true,
          message: 'OTP sent successfully (mock mode)',
          otp: otp
        };
      }
      
      // Send SMS via Twilio
      const message = await client.messages.create({
        body: `Your OneAnt verification code is: ${otp}. This code will expire in 10 minutes.`,
        from: fromNumber,
        to: formattedPhone
      });

      console.log(`SMS sent successfully. Message SID: ${message.sid}`);
      
      return {
        success: true,
        message: 'OTP sent successfully',
        otp: otp // Return OTP for session storage
      };
    } catch (error) {
      console.error('Error sending OTP:', error);
      
      // Handle specific Twilio errors
      if (error.code) {
        switch (error.code) {
          case 21211:
            return {
              success: false,
              message: 'Invalid phone number format. Please enter a valid phone number.',
              error: 'Invalid phone number'
            };
          case 21614:
            return {
              success: false,
              message: 'Phone number is not a valid mobile number',
              error: 'Invalid mobile number'
            };
          case 21408:
            return {
              success: false,
              message: 'Permission to send SMS to this number denied',
              error: 'SMS not allowed'
            };
          default:
            return {
              success: false,
              message: 'Failed to send OTP. Please try again.',
              error: error.message || 'Unknown error'
            };
        }
      }
      
      return {
        success: false,
        message: 'Failed to send OTP. Please try again.',
        error: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Verify OTP (for session-based verification)
   */
  verifyOTP(sessionOTP: string, providedOTP: string): boolean {
    return sessionOTP === providedOTP;
  }

  /**
   * Check if OTP is expired (10 minutes)
   */
  isOTPExpired(createdAt: Date | string): boolean {
    const now = new Date();
    // Handle both Date objects and date strings from session storage
    const createdDate = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
    const diffInMinutes = (now.getTime() - createdDate.getTime()) / (1000 * 60);
    return diffInMinutes > 10; // OTP expires after 10 minutes
  }
}

// Export singleton instance
export const otpService = new OTPService();
