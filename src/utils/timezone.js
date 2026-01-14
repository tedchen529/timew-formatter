/**
 * Timezone Conversion Utilities for UTC to Taipei (UTC+8) conversion
 */

const TAIPEI_TIMEZONE_OFFSET = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

/**
 * Converts UTC timestamp to Taipei timezone (UTC+8)
 * @param {string} utcTimestamp - UTC timestamp string
 * @returns {string} Taipei timestamp in ISO format with timezone
 */
export function convertToTaipeiTime(utcTimestamp) {
  if (utcTimestamp === null || utcTimestamp === undefined) {
    throw new Error("Timestamp is required");
  }

  if (typeof utcTimestamp !== "string") {
    throw new Error("Invalid timestamp format");
  }

  try {
    // Normalize timestamp - ensure it's treated as UTC
    let normalizedTimestamp = utcTimestamp;

    // Check if timestamp has timezone info (ends with Z or contains timezone offset like +08:00 or -05:00)
    const hasTimezone =
      utcTimestamp.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(utcTimestamp);

    if (!hasTimezone) {
      normalizedTimestamp = utcTimestamp + "Z";
    }

    const utcDate = new Date(normalizedTimestamp);

    if (isNaN(utcDate.getTime())) {
      throw new Error("Invalid timestamp format");
    }

    // Add 8 hours for Taipei timezone
    const taipeiTimeMillis = utcDate.getTime() + TAIPEI_TIMEZONE_OFFSET;
    const taipeiDate = new Date(taipeiTimeMillis);

    // Get the ISO string and format for Taipei timezone
    const taipeiISOString = taipeiDate.toISOString();
    const taipeiFormatted = taipeiISOString.slice(0, 19) + "+08:00";

    return taipeiFormatted;
  } catch (error) {
    throw new Error("Invalid timestamp format");
  }
}

/**
 * Extracts YYYY-MM-DD date from Taipei timezone timestamp
 * @param {string} taipeiTimestamp - Taipei timestamp with timezone info
 * @returns {string} Calendar date in YYYY-MM-DD format
 */
export function getTaipeiCalendarDate(taipeiTimestamp) {
  if (!taipeiTimestamp || typeof taipeiTimestamp !== "string") {
    throw new Error("Invalid Taipei timestamp format");
  }

  try {
    // Extract date part before 'T'
    const datePart = taipeiTimestamp.split("T")[0];

    // Validate format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(datePart)) {
      throw new Error("Invalid Taipei timestamp format");
    }

    return datePart;
  } catch (error) {
    throw new Error("Invalid Taipei timestamp format");
  }
}

/**
 * Converts timewarrior entries to Taipei timezone
 * @param {Array} entries - Array of timewarrior entries with UTC timestamps
 * @returns {Array} Entries with Taipei timestamps and calendar dates
 */
export function convertEntriesToTaipeiTimezone(entries) {
  if (!Array.isArray(entries)) {
    throw new Error("Entries must be an array");
  }

  if (entries.length === 0) {
    return [];
  }

  return entries.map((entry) => {
    if (!entry.start) {
      throw new Error("Entry missing required start time");
    }

    // Convert start time
    const taipeiStart = convertToTaipeiTime(entry.start);

    // Convert end time if it exists
    const taipeiEnd = entry.end ? convertToTaipeiTime(entry.end) : undefined;

    // Extract calendar date from start time
    const taipeiCalendarDate = getTaipeiCalendarDate(taipeiStart);

    // Return new entry with converted timestamps
    return {
      ...entry,
      start: taipeiStart,
      end: taipeiEnd,
      taipeiCalendarDate,
    };
  });
}

/**
 * Groups entries by Taipei calendar date
 * @param {Array} entries - Entries with taipeiCalendarDate field
 * @param {Object} options - Grouping options
 * @returns {Object} Grouped entries by date
 */
export function groupEntriesByTaipeiDate(entries, options = {}) {
  if (!Array.isArray(entries)) {
    throw new Error("Entries must be an array");
  }

  if (entries.length === 0) {
    return {};
  }

  const { includeMetadata = false } = options;
  const grouped = {};

  // Group entries by date
  entries.forEach((entry) => {
    if (!entry.taipeiCalendarDate) {
      throw new Error("Entry missing taipeiCalendarDate field");
    }

    const date = entry.taipeiCalendarDate;
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(entry);
  });

  // Sort date keys chronologically
  const sortedGrouped = {};
  const sortedDates = Object.keys(grouped).sort();

  sortedDates.forEach((date) => {
    if (includeMetadata) {
      sortedGrouped[date] = {
        entries: grouped[date],
        metadata: {
          entryCount: grouped[date].length,
        },
      };
    } else {
      sortedGrouped[date] = grouped[date];
    }
  });

  return sortedGrouped;
}

/**
 * Calculates UTC boundaries for a Taipei calendar date
 * @param {string} taipeiDate - Date in YYYY-MM-DD format
 * @returns {Object} Boundary timestamps in UTC and Taipei
 */
export function calculateDateBoundaries(taipeiDate) {
  if (taipeiDate === null || taipeiDate === undefined) {
    throw new Error("Date is required");
  }

  if (typeof taipeiDate !== "string") {
    throw new Error("Invalid date format. Expected YYYY-MM-DD");
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(taipeiDate)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD");
  }

  try {
    // Parse date components
    const [year, month, day] = taipeiDate.split("-").map(Number);

    // Create UTC timestamps directly
    // Taipei 00:00:00 = UTC 16:00:00 previous day (subtract 8 hours)
    const taipeiStartUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const utcStartOfDay = new Date(
      taipeiStartUTC.getTime() - TAIPEI_TIMEZONE_OFFSET
    );

    // Taipei 23:59:59.999 = UTC 15:59:59.999 same day
    const taipeiEndUTC = new Date(
      Date.UTC(year, month - 1, day, 23, 59, 59, 999)
    );
    const utcEndOfDay = new Date(
      taipeiEndUTC.getTime() - TAIPEI_TIMEZONE_OFFSET
    );

    // Format UTC timestamps
    const startUTCFormatted = utcStartOfDay.toISOString().slice(0, 19) + "Z";
    const endUTCFormatted = utcEndOfDay.toISOString();

    return {
      startUTC: startUTCFormatted,
      endUTC: endUTCFormatted,
      taipeiDate: taipeiDate,
      startTaipei: `${taipeiDate}T00:00:00+08:00`,
      endTaipei: `${taipeiDate}T23:59:59+08:00`,
    };
  } catch (error) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD");
  }
}

/**
 * Checks if UTC timestamp falls within Taipei date boundaries
 * @param {string} utcTimestamp - UTC timestamp to check
 * @param {Object} boundaries - Boundary object from calculateDateBoundaries
 * @returns {boolean} True if timestamp is within boundaries
 */
export function isWithinDateBoundaries(utcTimestamp, boundaries) {
  if (!utcTimestamp || typeof utcTimestamp !== "string") {
    throw new Error("Invalid timestamp format");
  }

  try {
    // Normalize timestamp
    let normalizedTimestamp = utcTimestamp;
    if (
      !utcTimestamp.endsWith("Z") &&
      !utcTimestamp.includes("+") &&
      !utcTimestamp.includes("-")
    ) {
      normalizedTimestamp = utcTimestamp + "Z";
    }

    const timestamp = new Date(normalizedTimestamp);

    if (isNaN(timestamp.getTime())) {
      throw new Error("Invalid timestamp format");
    }

    const startBoundary = new Date(boundaries.startUTC);
    const endBoundary = new Date(boundaries.endUTC);

    // Check if timestamp is within boundaries (inclusive start, exclusive end)
    return timestamp >= startBoundary && timestamp <= endBoundary;
  } catch (error) {
    throw new Error("Invalid timestamp format");
  }
}
