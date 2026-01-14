/**
 * Duplicate Detection Module
 *
 * Handles overlap checking for time entries to prevent duplicate data insertion.
 * Enforces business rule: "Block insertion if entries already exist in specified date range"
 */

/**
 * Validates that the database pool parameter is provided
 * @param {object} pool - Database connection pool
 * @throws {Error} If pool is null or undefined
 */
function validatePool(pool) {
  if (!pool) {
    throw new Error("Database pool is required");
  }
}

/**
 * Validates date parameters
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @throws {Error} If dates are invalid
 */
export function validateDateRange(startDate, endDate) {
  if (!startDate || typeof startDate !== "string" || startDate.trim() === "") {
    throw new Error("Start date is required");
  }

  if (!endDate || typeof endDate !== "string" || endDate.trim() === "") {
    throw new Error("End date is required");
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    throw new Error("Invalid start date format");
  }

  if (isNaN(end.getTime())) {
    throw new Error("Invalid end date format");
  }

  if (start > end) {
    throw new Error("Start date must be before or equal to end date");
  }
}

/**
 * Validates database response structure
 * @param {object} result - Database query result
 * @throws {Error} If result structure is invalid
 */
function validateDatabaseResponse(result) {
  if (!result || !Array.isArray(result.rows)) {
    throw new Error("Invalid database response");
  }
}

/**
 * Converts UTC timestamp to Taipei timezone for display
 * @param {string} utcTimestamp - UTC timestamp string
 * @returns {string} - Formatted Taipei time
 */
function toTaipeiTime(utcTimestamp) {
  if (!utcTimestamp) return null;

  const date = new Date(utcTimestamp);
  // Add 8 hours for Taipei timezone (UTC+8)
  const taipeiDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return taipeiDate.toISOString().replace("Z", "+08:00");
}

/**
 * Checks if two time ranges overlap
 * @param {string} start1 - Start time of first range
 * @param {string} end1 - End time of first range (can be null)
 * @param {string} start2 - Start time of second range
 * @param {string} end2 - End time of second range (can be null)
 * @returns {boolean} - True if ranges overlap
 */
function timeRangesOverlap(start1, end1, start2, end2) {
  const s1 = new Date(start1);
  const e1 = end1 ? new Date(end1) : null;
  const s2 = new Date(start2);
  const e2 = end2 ? new Date(end2) : null;

  // If either range has no end time (ongoing), check if start times conflict
  if (!e1 || !e2) {
    // For ongoing entries, any start after the ongoing start is a conflict
    return !e1 ? s2 >= s1 : s1 >= s2;
  }

  // Both ranges have end times - check for overlap
  // Ranges overlap if: start1 < end2 AND start2 < end1
  return s1 < e2 && s2 < e1;
}

/**
 * Checks if entries exist within specified date range
 * @param {object} pool - Database connection pool
 * @param {string} startDate - Start date of range to check
 * @param {string} endDate - End date of range to check
 * @returns {boolean} - True if entries exist in range
 * @throws {Error} For database errors or invalid parameters
 */
export async function hasEntriesInDateRange(pool, startDate, endDate) {
  validatePool(pool);
  validateDateRange(startDate, endDate);

  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM timewplus_entries WHERE "startTime" >= $1 AND "startTime" <= $2',
      [startDate, endDate]
    );

    validateDatabaseResponse(result);

    const count = parseInt(result.rows[0].count, 10);
    return count > 0;
  } catch (error) {
    // Re-throw validation errors as-is
    if (error.message.includes("Invalid database response")) {
      throw error;
    }
    // Re-throw database errors as-is
    throw error;
  }
}

/**
 * Checks for time overlaps between new entries and existing entries in date range
 * @param {object} pool - Database connection pool
 * @param {string} startDate - Start date of range to check
 * @param {string} endDate - End date of range to check
 * @param {Array} newEntries - Array of new entries to check for overlaps
 * @returns {object} - Object with hasOverlap boolean and overlaps array
 * @throws {Error} For database errors or invalid parameters
 */
export async function checkDateRangeOverlap(
  pool,
  startDate,
  endDate,
  newEntries
) {
  validatePool(pool);
  validateDateRange(startDate, endDate);

  if (!Array.isArray(newEntries)) {
    newEntries = [];
  }

  if (newEntries.length === 0) {
    return { hasOverlap: false, overlaps: [] };
  }

  try {
    // Get all existing entries in the date range
    const result = await pool.query(
      'SELECT * FROM timewplus_entries WHERE "startTime" >= $1 AND "startTime" <= $2 ORDER BY "startTime" ASC',
      [startDate, endDate]
    );

    validateDatabaseResponse(result);

    const existingEntries = result.rows;
    const overlaps = [];

    // Check each new entry against all existing entries
    for (const newEntry of newEntries) {
      for (const existingEntry of existingEntries) {
        if (
          timeRangesOverlap(
            newEntry.startTime,
            newEntry.endTime,
            existingEntry.startTime,
            existingEntry.endTime
          )
        ) {
          const overlapType =
            !existingEntry.endTime || !newEntry.endTime
              ? "ongoing_conflict"
              : "time_overlap";

          overlaps.push({
            newEntry,
            existingEntry,
            overlapType,
            taipeiTimes: {
              existingStart: toTaipeiTime(existingEntry.startTime),
              existingEnd: toTaipeiTime(existingEntry.endTime),
              newStart: toTaipeiTime(newEntry.startTime),
              newEnd: toTaipeiTime(newEntry.endTime),
            },
          });
        }
      }
    }

    return {
      hasOverlap: overlaps.length > 0,
      overlaps,
    };
  } catch (error) {
    // Re-throw validation errors as-is
    if (error.message.includes("Invalid database response")) {
      throw error;
    }
    // Re-throw database errors as-is
    throw error;
  }
}

/**
 * Gets detailed overlap information for error reporting
 * @param {object} pool - Database connection pool
 * @param {string} startDate - Start date of range to check
 * @param {string} endDate - End date of range to check
 * @param {Array} newEntries - Array of new entries to check
 * @returns {object} - Detailed overlap information
 * @throws {Error} For database errors or invalid parameters
 */
export async function getOverlapDetails(pool, startDate, endDate, newEntries) {
  validatePool(pool);
  validateDateRange(startDate, endDate);

  const overlapResult = await checkDateRangeOverlap(
    pool,
    startDate,
    endDate,
    newEntries
  );

  // Get count of existing entries
  const countResult = await pool.query(
    'SELECT COUNT(*) as count FROM timewplus_entries WHERE "startTime" >= $1 AND "startTime" <= $2',
    [startDate, endDate]
  );

  // Handle both possible response formats from mocks
  let existingCount = 0;
  if (countResult.rows && countResult.rows.length > 0) {
    const countValue = countResult.rows[0].count;
    if (typeof countValue === "string") {
      existingCount = parseInt(countValue, 10);
    } else if (typeof countValue === "number") {
      existingCount = countValue;
    } else {
      // If count field doesn't exist, try using rowCount or length
      existingCount = countResult.rowCount || countResult.rows.length || 0;
    }
  }

  return {
    dateRange: {
      start: startDate,
      end: endDate,
    },
    existingCount,
    newEntriesCount: newEntries.length,
    overlaps: overlapResult.overlaps,
  };
}

/**
 * Formats overlap error message with detailed information
 * @param {object} overlapDetails - Detailed overlap information
 * @returns {string} - Formatted error message
 */
export function formatOverlapError(overlapDetails) {
  const { overlaps, existingCount, newEntriesCount } = overlapDetails;
  const overlapCount = overlaps.length;

  let message = `Insertion blocked: ${overlapCount} overlap${
    overlapCount > 1 ? "s" : ""
  } detected between ${newEntriesCount} new entr${
    newEntriesCount > 1 ? "ies" : "y"
  } and ${existingCount} existing entr${existingCount > 1 ? "ies" : "y"}.\n\n`;

  message += "Conflicts:\n";

  for (let i = 0; i < overlaps.length; i++) {
    const overlap = overlaps[i];
    const { newEntry, existingEntry, overlapType } = overlap;

    message += `${i + 1}. New entry "${newEntry.sessionName}" (${new Date(
      newEntry.startTime
    )
      .toISOString()
      .slice(11, 16)}-${
      newEntry.endTime
        ? new Date(newEntry.endTime).toISOString().slice(11, 16)
        : "ongoing"
    }) `;
    message += `conflicts with existing "${
      existingEntry.sessionName
    }" (${new Date(existingEntry.startTime).toISOString().slice(11, 16)}-${
      existingEntry.endTime
        ? new Date(existingEntry.endTime).toISOString().slice(11, 16)
        : "ongoing"
    })\n`;
  }

  message +=
    "\nPlease resolve conflicts before proceeding. Consider using a different date range or removing conflicting existing entries.";

  return message;
}

/**
 * Blocks insertion if any overlap exists, throwing detailed error
 * @param {object} pool - Database connection pool
 * @param {string} startDate - Start date of range to check
 * @param {string} endDate - End date of range to check
 * @param {Array} newEntries - Array of new entries to check
 * @throws {Error} If overlaps are detected
 * @returns {void} - Returns nothing if no overlaps
 */
export async function blockInsertionIfOverlap(
  pool,
  startDate,
  endDate,
  newEntries
) {
  validatePool(pool);
  validateDateRange(startDate, endDate);

  // First, quick check if any entries exist in range
  const hasEntries = await hasEntriesInDateRange(pool, startDate, endDate);

  if (!hasEntries) {
    return; // No entries, safe to proceed
  }

  // Entries exist, check for specific overlaps
  const overlapResult = await checkDateRangeOverlap(
    pool,
    startDate,
    endDate,
    newEntries
  );

  if (overlapResult.hasOverlap) {
    // Generate error message directly from overlap result to avoid additional DB calls
    const { overlaps } = overlapResult;
    const overlapCount = overlaps.length;
    const newEntriesCount = newEntries.length;

    let message = `Insertion blocked: ${overlapCount} overlap${
      overlapCount > 1 ? "s" : ""
    } detected between ${newEntriesCount} new entr${
      newEntriesCount > 1 ? "ies" : "y"
    } and existing entries.\n\n`;

    message += "Conflicts:\n";

    for (let i = 0; i < overlaps.length; i++) {
      const overlap = overlaps[i];
      const { newEntry, existingEntry } = overlap;

      message += `${i + 1}. New entry "${newEntry.sessionName}" (${new Date(
        newEntry.startTime
      )
        .toISOString()
        .slice(11, 16)}-${
        newEntry.endTime
          ? new Date(newEntry.endTime).toISOString().slice(11, 16)
          : "ongoing"
      }) `;
      message += `conflicts with existing "${
        existingEntry.sessionName
      }" (${new Date(existingEntry.startTime).toISOString().slice(11, 16)}-${
        existingEntry.endTime
          ? new Date(existingEntry.endTime).toISOString().slice(11, 16)
          : "ongoing"
      })\n`;
    }

    message +=
      "\nPlease resolve conflicts before proceeding. Consider using a different date range or removing conflicting existing entries.";

    throw new Error(message);
  }
}
