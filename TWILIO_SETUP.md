# Twilio OTP Integration Setup

This document explains how to set up Twilio for OTP verification in the OneAnt Marketplace application.

## Environment Variables

Add the following environment variables to your `.env` file or environment configuration:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=AC5cd318143e6b8b2855ba8477c35556ec
TWILIO_AUTH_TOKEN=f400b3698ba22c4f512d9ef424a010df
TWILIO_PHONE_NUMBER=+19412063009

# Development Mode (optional)
TWILIO_MOCK_MODE=true  # Set to true to use mock mode in development
```

## Features Implemented

### 1. OTP Service (`server/otpService.ts`)
- **Random OTP Generation**: Generates 4-6 digit random OTPs
- **Phone Number Formatting**: Automatically formats phone numbers to E.164 format
- **SMS Sending**: Sends OTP via Twilio SMS
- **Error Handling**: Comprehensive error handling for various Twilio error codes
- **OTP Expiration**: 10-minute expiration for security
- **Session Compatibility**: Handles date serialization issues with session storage

### 2. Updated Phone Authentication (`server/phoneAuth.ts`)
- **Real SMS Integration**: Replaced mock OTP with actual Twilio SMS
- **Session Management**: Stores OTP in session for verification
- **Expiration Checking**: Validates OTP expiration before verification
- **Error Responses**: Proper error messages for different failure scenarios

### 3. Error Handling
The system handles common Twilio errors:
- **21211**: Invalid phone number format
- **21614**: Phone number is not a valid mobile number
- **21408**: Permission to send SMS denied
- **Generic errors**: Fallback error handling

## API Endpoints

### Send OTP
```
POST /api/auth/send-otp
Content-Type: application/json

{
  "phoneNumber": "5551234567",
  "sellerIntent": false
}
```

**Response:**
```json
{
  "message": "OTP sent successfully"
}
```

### Verify OTP
```
POST /api/auth/verify-otp
Content-Type: application/json

{
  "phoneNumber": "5551234567",
  "otp": "1234",
  "sellerIntent": false
}
```

**Response:**
```json
{
  "message": "OTP verified successfully",
  "user": {
    "id": "user-id",
    "phoneNumber": "5551234567",
    "firstName": "User",
    "lastName": "",
    "isSeller": false
  }
}
```

## Phone Number Formats Supported

The system automatically handles various phone number formats:
- `5551234567` (10 digits) → `+15551234567`
- `15551234567` (11 digits) → `+15551234567`
- `+15551234567` (E.164) → `+15551234567`

## Security Features

1. **OTP Expiration**: OTPs expire after 10 minutes
2. **Session-based Storage**: OTPs are stored in server sessions, not client-side
3. **Rate Limiting**: Built-in protection against spam (handled by Twilio)
4. **Input Validation**: Phone number format validation
5. **Error Sanitization**: Sensitive information is not exposed in error messages

## Testing

### Development Mode
For development and testing, you can enable mock mode by setting `TWILIO_MOCK_MODE=true`. This will:
- Skip actual SMS sending
- Generate real OTPs for testing
- Return the OTP in the response

In development mode, the OTP is returned in the response for testing purposes:
```json
{
  "message": "OTP sent successfully (mock mode)",
  "otp": "1234"
}
```

### Production Testing
For production testing with real SMS:
1. Use valid phone numbers (Twilio requires real numbers)
2. Ensure your Twilio account has sufficient credits
3. Test with your own phone number first

## Production Considerations

1. **Environment Variables**: Store Twilio credentials securely in production
2. **Rate Limiting**: Consider implementing additional rate limiting
3. **Monitoring**: Monitor Twilio usage and costs
4. **Fallback**: Consider implementing fallback mechanisms for SMS delivery failures

## Cost Optimization

- OTPs are only sent when requested
- Failed attempts don't consume SMS credits
- 10-minute expiration reduces unnecessary re-sends
- Proper error handling prevents duplicate sends
