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

// Connection retry configuration
const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds
const RETRY_MULTIPLIER = 2;

// Connection state tracking
let isConnected = false;
let reconnectAttempts = 0;
let reconnectTimer: NodeJS.Timeout | null = null;

// Create connection pool with enhanced error handling
function createPool(): Pool {
  return new Pool({ 
    connectionString: process.env.DATABASE_URL,
    // Serverless-optimized connection pool settings
    max: 20, // Reduced for serverless compatibility
    min: 2, // Minimal connections for serverless
    idleTimeoutMillis: 10000, // Standard idle timeout
    connectionTimeoutMillis: 5000, // Increased timeout for better reliability
    maxUses: 10000, // Standard connection reuse
    allowExitOnIdle: true, // Allow exit for serverless
    // Serverless-compatible optimizations
    statement_timeout: 10000, // Increased statement timeout
    application_name: 'amazon-groupon-ultra-fast',
  });
}

// Initialize pool
let pool = createPool();

// Enhanced database instance with retry logic
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

// Helper function to check if error is connection-related
function isConnectionError(error: any): boolean {
  const connectionErrorMessages = [
    'Connection terminated',
    'connection timeout',
    'WebSocket was closed',
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',
    'Connection lost',
    'Connection refused'
  ];
  
  const errorMessage = error.message?.toLowerCase() || '';
  return connectionErrorMessages.some(msg => errorMessage.includes(msg.toLowerCase()));
}

// Helper function to delay execution
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to attempt reconnection
async function attemptReconnection(): Promise<void> {
  try {
    console.log('🔄 Attempting to reconnect to database...');
    
    // Close existing pool
    await pool.end().catch(() => {});
    
    // Create new pool
    pool = createPool();
    
    // Test the new connection
    await pool.query('SELECT 1 as health_check');
    
    isConnected = true;
    reconnectAttempts = 0;
    console.log('✅ Database reconnection successful');
    
  } catch (error) {
    reconnectAttempts++;
    console.error(`❌ Database reconnection failed (attempt ${reconnectAttempts}):`, error);
    isConnected = false;
  }
}

// Enhanced query function with retry logic
export async function queryWithRetry<T>(operation: () => Promise<T>, operationName: string = 'database operation'): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const result = await operation();
      // Reset retry counter on successful operation
      if (attempt > 1) {
        console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
        reconnectAttempts = 0;
      }
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a connection-related error
      const isConnError = isConnectionError(error);
      
      if (isConnError && attempt < MAX_RETRY_ATTEMPTS) {
        const delayMs = Math.min(
          INITIAL_RETRY_DELAY * Math.pow(RETRY_MULTIPLIER, attempt - 1),
          MAX_RETRY_DELAY
        );
        
        console.warn(`⚠️ ${operationName} failed (attempt ${attempt}/${MAX_RETRY_ATTEMPTS}): ${error.message}`);
        console.log(`🔄 Retrying in ${delayMs}ms...`);
        
        await delay(delayMs);
        
        // Try to reconnect if this is a connection error
        if (attempt === 1) {
          await attemptReconnection();
        }
      } else {
        console.error(`❌ ${operationName} failed after ${attempt} attempts:`, error.message);
        break;
      }
    }
  }
  
  throw lastError;
}

// Enhanced connection health monitoring with automatic reconnection
async function performHealthCheck(): Promise<void> {
  try {
    const result = await queryWithRetry(
      () => pool.query('SELECT 1 as health_check'),
      'health check'
    );
    
    if (result.rows[0]?.health_check !== 1) {
      console.error('❌ Database health check failed - unexpected result');
      isConnected = false;
    } else {
      isConnected = true;
      if (reconnectAttempts > 0) {
        console.log('✅ Database health check passed - connection restored');
        reconnectAttempts = 0;
      }
    }
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    isConnected = false;
    
    // Attempt reconnection if not already in progress
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(async () => {
        await attemptReconnection();
        reconnectTimer = null;
      }, 5000); // Wait 5 seconds before attempting reconnection
    }
  }
}

// Start health monitoring
setInterval(performHealthCheck, 30000); // Check every 30 seconds

// Initial health check
performHealthCheck().catch(console.error);

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