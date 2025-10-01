import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;
type PoolType = InstanceType<typeof Pool>;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Connection retry configuration - optimized for performance
const MAX_RETRY_ATTEMPTS = 3; // Reduced retry attempts
const INITIAL_RETRY_DELAY = 500; // Faster initial retry
const MAX_RETRY_DELAY = 5000; // Reduced max delay
const RETRY_MULTIPLIER = 1.5; // Slower backoff

// Connection state tracking
let isConnected = false;
let reconnectAttempts = 0;
let reconnectTimer: NodeJS.Timeout | null = null;

// Create connection pool with enhanced error handling
function createPool(): PoolType {
  return new Pool({ 
    connectionString: process.env.DATABASE_URL,
    // Optimized for serverless performance
    max: 10, // Reduced for better serverless performance
    min: 1, // Minimal connections for serverless
    idleTimeoutMillis: 30000, // Longer idle timeout
    connectionTimeoutMillis: 10000, // Longer connection timeout
    maxUses: 1000, // Reduced connection reuse for stability
    allowExitOnIdle: true, // Allow exit for serverless
    // Performance optimizations
    statement_timeout: 30000, // Longer statement timeout
    application_name: 'amazon-groupon-optimized',
    // Connection pool optimizations
    keepAlive: true,
    keepAliveInitialDelayMillis: 0,
  });
}

// Initialize pool
let pool = createPool();

// Enhanced database instance with retry logic
let db = drizzle({ 
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

// Function to update database instance when pool changes
function updateDbInstance() {
  db = drizzle({ 
    client: pool, 
    schema,
    logger: process.env.NODE_ENV === 'development' ? {
      logQuery: (query, params) => {
        console.log(`🔍 Query: ${query}`);
        if (params.length > 0) console.log(`📝 Params:`, params);
      }
    } : false
  });
}

export { db };

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
    
    // Create new pool first
    const newPool = createPool();
    
    // Test the new connection
    await newPool.query('SELECT 1 as health_check');
    
    // Only close old pool after new one is working
    await pool.end().catch(() => {});
    
    // Replace the pool and update database instance
    pool = newPool;
    updateDbInstance();
    
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

// Start health monitoring - reduced frequency for better performance
setInterval(performHealthCheck, 300000); // Check every 5 minutes for better stability

// Skip initial health check to prevent startup issues
// performHealthCheck().catch(console.error);

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