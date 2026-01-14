import { Pool } from "pg";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Store the singleton pool instance
let pool = null;

/**
 * Validates all required environment variables are present and valid
 * @throws {Error} If any required environment variable is missing or invalid
 */
export function validateEnvironment() {
  const required = ["DB_USER", "DB_PASS", "DB_NAME", "START_DATE", "PORT"];

  // Check for missing required variables
  for (const variable of required) {
    if (!process.env[variable]) {
      throw new Error(`Missing required environment variable: ${variable}`);
    }
  }

  // Validate START_DATE format (YYYY-MM-DD)
  const startDate = process.env.START_DATE;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate)) {
    throw new Error("START_DATE must be in YYYY-MM-DD format");
  }

  // Additional date validation - check if it's a valid date
  const parsedDate = new Date(startDate);
  if (parsedDate.toISOString().slice(0, 10) !== startDate) {
    throw new Error("START_DATE must be in YYYY-MM-DD format");
  }

  // Validate PORT is a valid number
  const port = parseInt(process.env.PORT, 10);
  if (isNaN(port)) {
    throw new Error("PORT must be a valid number");
  }

  // Validate PORT is within valid range
  if (port < 1000 || port > 65535) {
    throw new Error("PORT must be between 1000 and 65535");
  }
}

/**
 * Creates and returns a PostgreSQL connection pool
 * Uses singleton pattern to ensure only one pool exists
 * @returns {Promise<Pool>} PostgreSQL connection pool
 */
export async function createConnection() {
  // Validate environment before creating connection
  validateEnvironment();

  // Return existing pool if already created
  if (pool) {
    return pool;
  }

  // Parse pool configuration from environment
  const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
    min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10) || 30000,
  };

  // Create new pool instance
  pool = new Pool(config);

  return pool;
}

/**
 * Tests the database connection by executing a simple query
 * @returns {Promise<{success: boolean, version?: string, error?: string}>}
 */
export async function testConnection() {
  let client = null;

  try {
    // Ensure we have a connection pool
    const connectionPool = await createConnection();

    // Get a client from the pool
    client = await connectionPool.connect();

    // Execute a simple query to test the connection
    const result = await client.query("SELECT version()");

    return {
      success: true,
      version: result.rows[0].version,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  } finally {
    // Always release the client back to the pool if it was acquired
    if (client && typeof client.release === "function") {
      try {
        client.release();
      } catch (releaseError) {
        // Ignore release errors to avoid masking the original error
        console.warn("Error releasing database client:", releaseError.message);
      }
    }
  }
}

/**
 * Gracefully closes the connection pool
 * Handles multiple calls safely and resets internal pool reference
 */
export async function closeConnection() {
  if (!pool) {
    return; // Already closed or never created
  }

  try {
    await pool.end();
  } catch (error) {
    // Log error but don't throw - we want cleanup to be graceful
    console.warn(
      "Error while closing database connection pool:",
      error.message
    );
  } finally {
    // Reset pool reference regardless of whether end() succeeded
    pool = null;
  }
}
