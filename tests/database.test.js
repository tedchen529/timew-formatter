import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createConnection,
  testConnection,
  closeConnection,
  validateEnvironment,
} from "../src/database/connection.js";

// Mock the pg module
vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    end: vi.fn(),
    query: vi.fn(),
  })),
}));

// Mock dotenv
vi.mock("dotenv", () => ({
  default: {
    config: vi.fn(),
  },
}));

describe("Database Connection Module", () => {
  let originalEnv;

  beforeEach(async () => {
    // Store original environment variables
    originalEnv = process.env;

    // Reset environment variables for each test
    process.env = {
      ...originalEnv,
      DB_USER: "test_user",
      DB_PASS: "test_password",
      DB_NAME: "timewplus_db",
      DB_HOST: "localhost",
      DB_PORT: "5432",
      START_DATE: "2024-01-01",
      PORT: "3000",
    };

    // Clear all mocks
    vi.clearAllMocks();

    // Reset the connection module state
    const connectionModule = await import("../src/database/connection.js");
    if (connectionModule.closeConnection) {
      await connectionModule.closeConnection();
    }
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe("Environment Variable Validation", () => {
    it("should validate all required environment variables are present", () => {
      expect(() => validateEnvironment()).not.toThrow();
    });

    it("should throw error when DB_USER is missing", () => {
      delete process.env.DB_USER;
      expect(() => validateEnvironment()).toThrow(
        "Missing required environment variable: DB_USER"
      );
    });

    it("should throw error when DB_PASS is missing", () => {
      delete process.env.DB_PASS;
      expect(() => validateEnvironment()).toThrow(
        "Missing required environment variable: DB_PASS"
      );
    });

    it("should throw error when DB_NAME is missing", () => {
      delete process.env.DB_NAME;
      expect(() => validateEnvironment()).toThrow(
        "Missing required environment variable: DB_NAME"
      );
    });

    it("should throw error when START_DATE is missing", () => {
      delete process.env.START_DATE;
      expect(() => validateEnvironment()).toThrow(
        "Missing required environment variable: START_DATE"
      );
    });

    it("should throw error when PORT is missing", () => {
      delete process.env.PORT;
      expect(() => validateEnvironment()).toThrow(
        "Missing required environment variable: PORT"
      );
    });

    it("should validate START_DATE format (YYYY-MM-DD)", () => {
      process.env.START_DATE = "invalid-date";
      expect(() => validateEnvironment()).toThrow(
        "START_DATE must be in YYYY-MM-DD format"
      );
    });

    it("should validate PORT is a valid number", () => {
      process.env.PORT = "not-a-number";
      expect(() => validateEnvironment()).toThrow(
        "PORT must be a valid number"
      );
    });

    it("should validate PORT is within valid range (1000-65535)", () => {
      process.env.PORT = "999";
      expect(() => validateEnvironment()).toThrow(
        "PORT must be between 1000 and 65535"
      );

      process.env.PORT = "65536";
      expect(() => validateEnvironment()).toThrow(
        "PORT must be between 1000 and 65535"
      );
    });

    it("should accept default values for optional DB_HOST and DB_PORT", () => {
      delete process.env.DB_HOST;
      delete process.env.DB_PORT;
      expect(() => validateEnvironment()).not.toThrow();
    });
  });

  describe("Database Connection Pool", () => {
    it("should create connection pool with correct configuration", async () => {
      const { Pool } = await import("pg");

      await createConnection();

      expect(Pool).toHaveBeenCalledWith({
        user: "test_user",
        password: "test_password",
        database: "timewplus_db",
        host: "localhost",
        port: 5432,
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
      });
    });

    it("should use default host and port when not provided", async () => {
      delete process.env.DB_HOST;
      delete process.env.DB_PORT;

      const { Pool } = await import("pg");

      await createConnection();

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "localhost",
          port: 5432,
        })
      );
    });

    it("should use environment pool configuration when provided", async () => {
      process.env.DB_POOL_MIN = "3";
      process.env.DB_POOL_MAX = "15";
      process.env.DB_POOL_IDLE_TIMEOUT = "60000";

      const { Pool } = await import("pg");

      await createConnection();

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          max: 15,
          min: 3,
          idleTimeoutMillis: 60000,
        })
      );
    });

    it("should return the same pool instance on multiple calls", async () => {
      const pool1 = await createConnection();
      const pool2 = await createConnection();

      expect(pool1).toBe(pool2);
    });

    it("should validate environment before creating connection", async () => {
      delete process.env.DB_USER;

      await expect(createConnection()).rejects.toThrow(
        "Missing required environment variable: DB_USER"
      );
    });
  });

  describe("Connection Testing", () => {
    it("should successfully test database connection", async () => {
      const mockPool = {
        connect: vi.fn().mockResolvedValue({
          query: vi
            .fn()
            .mockResolvedValue({ rows: [{ version: "PostgreSQL 14.0" }] }),
          release: vi.fn(),
        }),
      };

      const { Pool } = await import("pg");
      Pool.mockImplementation(() => mockPool);

      const result = await testConnection();

      expect(result.success).toBe(true);
      expect(result.version).toContain("PostgreSQL");
      expect(mockPool.connect).toHaveBeenCalled();
    });

    it("should handle connection failures gracefully", async () => {
      const mockPool = {
        connect: vi.fn().mockRejectedValue(new Error("Connection failed")),
      };

      const { Pool } = await import("pg");
      Pool.mockImplementation(() => mockPool);

      const result = await testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection failed");
    });

    it("should handle database query failures", async () => {
      const mockClient = {
        query: vi.fn().mockRejectedValue(new Error("Query failed")),
        release: vi.fn(),
      };
      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };

      const { Pool } = await import("pg");
      Pool.mockImplementation(() => mockPool);

      const result = await testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Query failed");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should release client connection even on query failure", async () => {
      const mockClient = {
        query: vi.fn().mockRejectedValue(new Error("Query failed")),
        release: vi.fn(),
      };
      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };

      const { Pool } = await import("pg");
      Pool.mockImplementation(() => mockPool);

      await testConnection();

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("Connection Cleanup", () => {
    it("should gracefully close connection pool", async () => {
      const mockPool = {
        end: vi.fn().mockResolvedValue(),
        connect: vi.fn(),
        query: vi.fn(),
      };

      const { Pool } = await import("pg");
      Pool.mockImplementation(() => mockPool);

      // Create a connection first
      await createConnection();

      // Then close it
      await closeConnection();

      expect(mockPool.end).toHaveBeenCalled();
    });

    it("should handle close errors gracefully", async () => {
      const mockPool = {
        end: vi.fn().mockRejectedValue(new Error("Close failed")),
        connect: vi.fn(),
        query: vi.fn(),
      };

      const { Pool } = await import("pg");
      Pool.mockImplementation(() => mockPool);

      // Create a connection first
      await createConnection();

      // Closing should not throw even if pool.end() fails
      await expect(closeConnection()).resolves.not.toThrow();
      expect(mockPool.end).toHaveBeenCalled();
    });

    it("should handle multiple close calls safely", async () => {
      const mockPool = {
        end: vi.fn().mockResolvedValue(),
        connect: vi.fn(),
        query: vi.fn(),
      };

      const { Pool } = await import("pg");
      Pool.mockImplementation(() => mockPool);

      // Create a connection first
      await createConnection();

      // Close multiple times should be safe
      await closeConnection();
      await closeConnection();

      // end() should only be called once
      expect(mockPool.end).toHaveBeenCalledTimes(1);
    });

    it("should reset internal pool reference after closing", async () => {
      const { Pool } = await import("pg");

      // Create and close connection
      await createConnection();
      await closeConnection();

      // Creating new connection should create new pool instance
      await createConnection();

      expect(Pool).toHaveBeenCalledTimes(2);
    });
  });
});
