import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// ULTRA-FAST serverless-compatible connection pool
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Serverless-optimized connection pool settings
  max: 20, // Reduced for serverless compatibility
  min: 2, // Minimal connections for serverless
  idleTimeoutMillis: 10000, // Standard idle timeout
  connectionTimeoutMillis: 2000, // Reasonable connection timeout
  maxUses: 10000, // Standard connection reuse
  allowExitOnIdle: true, // Allow exit for serverless
  // Serverless-compatible optimizations
  statement_timeout: 5000, // 5 second statement timeout
  application_name: 'amazon-groupon-ultra-fast',
});

// Serverless-compatible connection optimization
pool.on('connect', (client) => {
  // Set serverless-optimized connection parameters
  client.query('SET statement_timeout = 5000');
  client.query('SET idle_in_transaction_session_timeout = 10000');
  // Note: Serverless databases don't support query_timeout, work_mem, shared_buffers, etc.
});

export const db = drizzle({ 
  client: pool, 
  schema,
  // Disable logging in production for speed
  logger: process.env.NODE_ENV === 'development' ? {
    logQuery: (query, params) => {
      console.log(`🔍 Query: ${query}`);
      if (params.length > 0) console.log(`📝 Params:`, params);
    }
  } : false
});

// Connection health monitoring
setInterval(async () => {
  try {
    const result = await pool.query('SELECT 1 as health_check');
    if (result.rows[0]?.health_check !== 1) {
      console.error('❌ Database health check failed');
    }
  } catch (error) {
    console.error('❌ Database connection error:', error);
  }
}, 30000); // Check every 30 seconds

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Gracefully closing database connections...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 Gracefully closing database connections...');
  await pool.end();
  process.exit(0);
});