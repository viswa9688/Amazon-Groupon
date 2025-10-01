#!/usr/bin/env tsx

import bcrypt from 'bcrypt';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { adminCredentials } from '../shared/schema';
import { eq } from 'drizzle-orm';

const { Pool } = pg;

// Admin credentials to insert
const ADMIN_EMAIL = 'viswa968@gmail.com';
const ADMIN_PASSWORD = 'QW@#er1234';

async function insertAdminCredentials() {
  console.log('\n🔐 Inserting admin credentials...\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    // Connect to database
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
    });

    const db = drizzle({ client: pool, schema: { adminCredentials } });

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, saltRounds);
    
    console.log(`📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🔒 Password: ${ADMIN_PASSWORD}`);
    console.log(`🔐 Password Hash: ${passwordHash.substring(0, 20)}...`);
    console.log(`🗄️  Database: ${process.env.DATABASE_URL.includes('npg_p3yO0ofYsHcv') ? 'PRODUCTION' : 'DEVELOPMENT'}\n`);

    // Check if admin already exists
    const existingAdmin = await db
      .select()
      .from(adminCredentials)
      .where(eq(adminCredentials.userId, ADMIN_EMAIL))
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
        .where(eq(adminCredentials.userId, ADMIN_EMAIL));
      
      console.log('✅ Admin credentials UPDATED successfully!\n');
    } else {
      // Create new admin
      await db.insert(adminCredentials).values({
        userId: ADMIN_EMAIL,
        passwordHash,
        isActive: true,
      });
      
      console.log('✅ Admin credentials CREATED successfully!\n');
    }

    await pool.end();
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

insertAdminCredentials();
