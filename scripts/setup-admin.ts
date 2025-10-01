#!/usr/bin/env tsx

import { createInterface } from 'readline';
import bcrypt from 'bcrypt';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { adminCredentials } from '../shared/schema';
import { eq } from 'drizzle-orm';

const { Pool } = pg;

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

async function setupAdmin() {
  console.log(`\n${colors.cyan}${colors.bright}========================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}   OneAnt Admin Setup Utility${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}========================================${colors.reset}\n`);

  // Check DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error(`${colors.red}❌ ERROR: DATABASE_URL environment variable is not set${colors.reset}`);
    console.log(`\nPlease ensure your database is configured.`);
    process.exit(1);
  }

  console.log(`${colors.yellow}⚠️  SECURITY NOTICE:${colors.reset}`);
  console.log(`This script will create admin credentials for OneAnt.`);
  console.log(`${colors.yellow}After setup is complete, DELETE this script for security.${colors.reset}\n`);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(query, resolve);
    });
  };

  try {
    // Get admin email
    const userId = await question(`${colors.cyan}Enter admin email:${colors.reset} `);
    
    if (!userId || userId.trim().length === 0) {
      console.error(`\n${colors.red}❌ Admin email cannot be empty${colors.reset}`);
      rl.close();
      process.exit(1);
    }

    // Get password (Note: will be visible on screen - for secure production use, consider using a library that hides input)
    const password = await question(`${colors.cyan}Enter admin password:${colors.reset} `);
    
    if (!password || password.trim().length < 8) {
      console.error(`\n${colors.red}❌ Password must be at least 8 characters${colors.reset}`);
      rl.close();
      process.exit(1);
    }

    // Confirm password
    const confirmPassword = await question(`${colors.cyan}Confirm admin password:${colors.reset} `);
    
    if (password !== confirmPassword) {
      console.error(`\n${colors.red}❌ Passwords do not match${colors.reset}`);
      rl.close();
      process.exit(1);
    }

    rl.close();

    console.log(`\n${colors.yellow}⏳ Creating admin credentials...${colors.reset}`);

    // Connect to database
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
    });

    const db = drizzle({ client: pool, schema: { adminCredentials } });

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Check if admin already exists
    const existingAdmin = await db
      .select()
      .from(adminCredentials)
      .where(eq(adminCredentials.userId, userId.trim()))
      .limit(1);

    if (existingAdmin.length > 0) {
      // Update existing admin
      await db
        .update(adminCredentials)
        .set({
          passwordHash,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(adminCredentials.userId, userId.trim()));
      
      console.log(`\n${colors.green}✅ Admin credentials UPDATED successfully!${colors.reset}`);
    } else {
      // Create new admin
      await db.insert(adminCredentials).values({
        userId: userId.trim(),
        passwordHash,
        isActive: true,
      });
      
      console.log(`\n${colors.green}✅ Admin credentials CREATED successfully!${colors.reset}`);
    }

    console.log(`\n${colors.bright}Admin Details:${colors.reset}`);
    console.log(`  Email: ${userId.trim()}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);

    console.log(`\n${colors.yellow}${colors.bright}⚠️  IMPORTANT SECURITY STEPS:${colors.reset}`);
    console.log(`${colors.yellow}1. DELETE this script immediately: rm scripts/setup-admin.ts${colors.reset}`);
    console.log(`${colors.yellow}2. Never commit admin credentials to version control${colors.reset}`);
    console.log(`${colors.yellow}3. Use strong, unique passwords for production${colors.reset}\n`);

    await pool.end();
    process.exit(0);

  } catch (error: any) {
    console.error(`\n${colors.red}❌ Error setting up admin:${colors.reset}`, error.message);
    rl.close();
    process.exit(1);
  }
}

// Run the setup
setupAdmin().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
