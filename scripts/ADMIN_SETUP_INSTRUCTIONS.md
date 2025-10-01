# Admin Setup Instructions

## Setting Up Admin Credentials

This is a **one-time setup** to create admin access for OneAnt.

### Steps:

1. **Run the setup script:**
   ```bash
   npx tsx scripts/setup-admin.ts
   ```

2. **Enter your admin credentials when prompted:**
   - Admin email (e.g., viswa968@gmail.com)
   - Password (minimum 8 characters)
   - Confirm password

3. **For Production:** Run the same command in your production environment to set up production admin credentials.

4. **IMPORTANT - Delete the script after use:**
   ```bash
   rm scripts/setup-admin.ts
   rm scripts/ADMIN_SETUP_INSTRUCTIONS.md
   ```

### Security Notes:
- ✅ Passwords are hashed with bcrypt before storage
- ✅ No plaintext passwords are stored in the database
- ⚠️ Password will be visible when typing (one-time setup only)
- ⚠️ DELETE the setup script immediately after use

### What the script does:
1. Prompts for admin email and password
2. Hashes the password securely with bcrypt (10 salt rounds)
3. Creates or updates admin credentials in the database
4. Provides confirmation and cleanup instructions

### Troubleshooting:
- **"DATABASE_URL must be set"** - Ensure your database is configured
- **"Admin email cannot be empty"** - Enter a valid email
- **"Password must be at least 8 characters"** - Use a stronger password
- **"Passwords do not match"** - Retype carefully

### Admin Login:
After setup, you can login at the admin endpoint using:
- Email: [your admin email]
- Password: [your admin password]
