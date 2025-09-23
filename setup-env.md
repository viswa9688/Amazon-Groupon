# Environment Setup Guide

## Required Environment Variables

### Google Distance Matrix API Key

To enable delivery charge calculations, you need to set up the Google Distance Matrix API key:

1. **Get a Google Cloud API Key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Distance Matrix API
   - Create credentials (API Key)
   - Restrict the API key to Distance Matrix API for security

2. **Set the Environment Variable:**

   **For Development (Local):**
   ```bash
   # Create a .env file in the project root
   echo "GOOGLE_DISTANCE_MATRIX_API_KEY=your_actual_api_key_here" > .env
   ```

   **For Production (Replit):**
   - Go to your Replit project
   - Click on the "Secrets" tab in the sidebar
   - Add a new secret:
     - Key: `GOOGLE_DISTANCE_MATRIX_API_KEY`
     - Value: `your_actual_api_key_here`

   **For Production (Other platforms):**
   ```bash
   export GOOGLE_DISTANCE_MATRIX_API_KEY=your_actual_api_key_here
   ```

3. **Verify Setup:**
   - Restart your application
   - Check the console logs for "Google Distance Matrix API key not configured" message
   - If you see this message, the API key is not properly set

## Fallback Behavior

If the Google API key is not configured or the API is unavailable:
- The system will use estimated distances (15km default)
- Delivery charges will still be calculated based on the fallback distance
- The application will continue to work normally
- You'll see warning messages in the console

## Security Best Practices

1. **Never commit API keys to version control**
2. **Use environment variables for all sensitive configuration**
3. **Restrict API keys to specific services and IP addresses**
4. **Rotate API keys regularly**
5. **Monitor API usage and set up billing alerts**

## Testing the Setup

Once configured, you can test the delivery system by:
1. Creating an order with a delivery address
2. Checking the order response for delivery charge information
3. Verifying that real distance calculations are being performed (check console logs)

