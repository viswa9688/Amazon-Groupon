# Environment Setup Guide

## Required Environment Variables

### Google Distance Matrix API Key

To enable delivery charge calculations, you need to set up the Google Distance Matrix API key:

### Google Geocoding API Key

To enable British Columbia address validation, you need to set up the Google Geocoding API key:

1. **Get a Google Cloud API Key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Distance Matrix API
   - Enable the Geocoding API
   - Create credentials (API Key)
   - Restrict the API key to Distance Matrix API and Geocoding API for security

2. **Set the Environment Variables:**

   **For Development (Local):**
   ```bash
   # Create a .env file in the project root
   echo "GOOGLE_DISTANCE_MATRIX_API_KEY=your_actual_api_key_here" > .env
   echo "GOOGLE_GEOCODING_API_KEY=your_actual_api_key_here" >> .env
   ```

   **For Production (Replit):**
   - Go to your Replit project
   - Click on the "Secrets" tab in the sidebar
   - Add new secrets:
     - Key: `GOOGLE_DISTANCE_MATRIX_API_KEY`, Value: `your_actual_api_key_here`
     - Key: `GOOGLE_GEOCODING_API_KEY`, Value: `your_actual_api_key_here`

   **For Production (Other platforms):**
   ```bash
   export GOOGLE_DISTANCE_MATRIX_API_KEY=your_actual_api_key_here
   export GOOGLE_GEOCODING_API_KEY=your_actual_api_key_here
   ```

3. **Verify Setup:**
   - Restart your application
   - Check the console logs for:
     - "✅ Google Distance Matrix API key configured"
     - "✅ Google Geocoding API key configured"
   - If you see warning messages, the API keys are not properly set

## Fallback Behavior

If the Google API keys are not configured or the APIs are unavailable:

**Distance Matrix API:**
- The system will use estimated distances (15km default)
- Delivery charges will still be calculated based on the fallback distance
- You'll see warning messages in the console

**Geocoding API:**
- BC address validation will be disabled
- All addresses will be treated as non-BC addresses
- Payment and delivery will be blocked for all addresses
- You'll see warning messages in the console

**Important:** Without the Geocoding API key, the system will not allow any deliveries as it cannot verify BC addresses.

## Security Best Practices

1. **Never commit API keys to version control**
2. **Use environment variables for all sensitive configuration**
3. **Restrict API keys to specific services and IP addresses**
4. **Rotate API keys regularly**
5. **Monitor API usage and set up billing alerts**

## British Columbia Delivery Constraints

The system enforces specific delivery constraints for British Columbia addresses:

### Group Orders
- **Minimum Order Value:** $50.00
- **Delivery Fee:** $5.99 (if order total < $100.00)
- **Free Delivery:** Orders $100.00 and above

### Individual Orders
- **Minimum Order Value:** $25.00
- **Delivery Fee:** $3.99 (if order total < $75.00)
- **Free Delivery:** Orders $75.00 and above

### Address Validation
- All addresses are validated using Google Geocoding API
- Only addresses in British Columbia (BC) are accepted
- Non-BC addresses will be rejected during payment
- The system checks for BC province names and postal code patterns

## Testing the Setup

Once configured, you can test the delivery system by:
1. Creating an order with a BC delivery address
2. Verifying minimum order value requirements are enforced
3. Testing delivery fee calculations based on order type and total
4. Checking the order response for delivery charge information
5. Verifying that real distance calculations are being performed (check console logs)

