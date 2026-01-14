import { createConnection } from "./connection.js";

/**
 * Maps a timewarrior entry to database entry format
 * @param {Object} timewarriorEntry - Raw entry from timewarrior export
 * @returns {Object} Entry object formatted for database insertion
 */
export function mapTimewarriorToEntry(timewarriorEntry) {
  const { start, end, tags = [], annotation } = timewarriorEntry;

  // Convert timewarrior timestamp format (20260114T020000Z) to Date object
  const startTime = parseTimewarriorTimestamp(start);
  const endTime = end ? parseTimewarriorTimestamp(end) : null;

  // Extract sessionName from first tag, or null if no tags
  const sessionName = tags.length > 0 ? tags[0] : null;

  return {
    startTime,
    endTime,
    sessionName,
    annotation: annotation || null,
  };
}

/**
 * Validates entry has all required fields and business rules
 * @param {Object} entry - Entry object to validate
 * @throws {Error} If validation fails
 */
export function validateEntry(entry) {
  const { startTime, endTime, projectId, groupType } = entry;

  if (!startTime) {
    throw new Error("startTime is required");
  }

  if (projectId === undefined || projectId === null) {
    throw new Error("projectId is required");
  }

  if (!groupType) {
    throw new Error("groupType is required");
  }

  // If both startTime and endTime exist, endTime must be after startTime
  if (endTime && startTime && endTime <= startTime) {
    throw new Error("endTime must be after startTime");
  }
}

/**
 * Inserts a single entry into the database with transaction
 * @param {Object} pool - Database connection pool
 * @param {Object} entry - Entry object to insert
 * @returns {Object} Inserted entry with generated id
 */
export async function insertEntry(pool, entry) {
  // Validate entry before attempting insertion
  validateEntry(entry);

  const client = await pool.connect();

  try {
    // Start transaction
    await client.query("BEGIN");

    // Insert entry
    const insertQuery = `INSERT INTO timewplus_entries ("startTime", "endTime", "sessionName", "projectId", "annotation", "groupType") 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;

    const values = [
      entry.startTime,
      entry.endTime,
      entry.sessionName,
      entry.projectId,
      entry.annotation,
      entry.groupType,
    ];

    const result = await client.query(insertQuery, values);

    // Commit transaction
    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    // Rollback transaction on any error
    await client.query("ROLLBACK");
    throw error;
  } finally {
    // Always release client back to pool
    client.release();
  }
}

/**
 * Inserts multiple entries in a single transaction
 * @param {Object} pool - Database connection pool
 * @param {Array} entries - Array of entry objects to insert
 * @returns {Array} Array of inserted entries with generated ids
 */
export async function insertEntries(pool, entries) {
  // Handle empty array
  if (entries.length === 0) {
    return [];
  }

  // Validate all entries before starting transaction
  for (const entry of entries) {
    validateEntry(entry);
  }

  const client = await pool.connect();
  const results = [];

  try {
    // Start transaction
    await client.query("BEGIN");

    // Insert each entry
    for (const entry of entries) {
      const insertQuery = `INSERT INTO timewplus_entries ("startTime", "endTime", "sessionName", "projectId", "annotation", "groupType") 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;

      const values = [
        entry.startTime,
        entry.endTime,
        entry.sessionName,
        entry.projectId,
        entry.annotation,
        entry.groupType,
      ];

      const result = await client.query(insertQuery, values);
      results.push(result.rows[0]);
    }

    // Commit transaction
    await client.query("COMMIT");

    return results;
  } catch (error) {
    // Rollback entire transaction if any insertion fails
    await client.query("ROLLBACK");
    throw error;
  } finally {
    // Always release client back to pool
    client.release();
  }
}

/**
 * Rolls back a transaction
 * @param {Object} client - Database client
 */
export async function rollbackTransaction(client) {
  await client.query("ROLLBACK");
}

/**
 * Parses timewarrior timestamp format to JavaScript Date
 * @param {string} timestamp - Timestamp in format "20260114T020000Z"
 * @returns {Date} JavaScript Date object
 */
function parseTimewarriorTimestamp(timestamp) {
  // Format: 20260114T020000Z
  // Year: 2026, Month: 01, Day: 14, Hour: 02, Minute: 00, Second: 00
  const year = parseInt(timestamp.substr(0, 4));
  const month = parseInt(timestamp.substr(4, 2)) - 1; // Month is 0-indexed in JS
  const day = parseInt(timestamp.substr(6, 2));
  const hour = parseInt(timestamp.substr(9, 2));
  const minute = parseInt(timestamp.substr(11, 2));
  const second = parseInt(timestamp.substr(13, 2));

  return new Date(Date.UTC(year, month, day, hour, minute, second));
}
