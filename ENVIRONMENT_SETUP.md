# Environment Variables Setup Guide

## Required Twilio Credentials

You need to create a `.env` file in the root directory with the following variables:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number_here

# Development Settings
NODE_ENV=development
TWILIO_MOCK_MODE=false
```

## How to Get Your Twilio Credentials

### 1. Account SID and Auth Token
1. Go to [Twilio Console](https://console.twilio.com/)
2. Log in to your account
3. On the dashboard, you'll see:
   - **Account SID**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Auth Token**: Click "Show" to reveal it

### 2. Phone Number
1. In Twilio Console, go to **Phone Numbers** → **Manage** → **Active numbers**
2. Copy your Twilio phone number (format: `+1xxxxxxxxxx`)
3. This is the number that will send SMS messages

### 3. Verify Phone Numbers (for Trial Accounts)
1. Go to **Phone Numbers** → **Manage** → **Verified Caller IDs**
2. Add the phone numbers you want to send SMS to
3. Verify them via SMS or call

## Current Hardcoded Values (to be replaced)

The following values are currently hardcoded in `server/otpService.ts`:

```typescript
// These will be replaced with environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID || 'AC5cd318143e6b8b2855ba8477c35556ec';
const authToken = process.env.TWILIO_AUTH_TOKEN || 'f400b3698ba22c4f512d9ef424a010df';
const fromNumber = process.env.TWILIO_PHONE_NUMBER || '+19412063009';
```

## Steps to Set Up

1. **Create `.env` file** in the root directory
2. **Add your credentials** to the `.env` file
3. **Verify phone numbers** in Twilio Console (for trial accounts)
4. **Restart the server** to load new environment variables

## Security Notes

- Never commit `.env` files to version control
- Keep your Auth Token secret
- Use different credentials for development and production
- Consider using Twilio's Test Credentials for development

## Testing

After setting up the environment variables:

1. Start the server: `npm run dev`
2. Test SMS: `POST /api/auth/send-otp` with a verified phone number
3. Check Twilio Console for message logs and delivery status
