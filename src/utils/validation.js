import { convertToTaipeiTime, getTaipeiCalendarDate } from "./timezone.js";

/**
 * Validates ISO timestamp format
 * @param {string} timestamp - The timestamp to validate
 * @returns {boolean} - True if valid format, false otherwise
 */
export function validateTimestampFormat(timestamp) {
  // Check if timestamp is a string
  if (typeof timestamp !== "string" || timestamp === "") {
    return false;
  }

  // Basic ISO format validation with regex
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?$/;
  if (!isoRegex.test(timestamp)) {
    return false;
  }

  // Try parsing to validate actual date values
  try {
    const date = new Date(timestamp);
    // Check if the date is valid (not NaN)
    if (isNaN(date.getTime())) {
      return false;
    }

    // Additional validation: ensure the date components are valid
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();

    // Check reasonable bounds for date components
    if (
      year < 1970 ||
      year > 2100 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validates timestamp is within reasonable range
 * @param {string} timestamp - The timestamp to validate
 * @returns {boolean} - True if within range, false otherwise
 */
export function validateTimestampRange(timestamp) {
  if (!validateTimestampFormat(timestamp)) {
    return false;
  }

  try {
    const date = new Date(timestamp);
    const now = new Date();

    // Get START_DATE from environment or default to 2024-01-01
    const startDate = new Date(process.env.START_DATE || "2024-01-01");

    // Reject timestamps too far in the future (more than 1 year from now)
    const maxFutureDate = new Date(
      now.getFullYear() + 1,
      now.getMonth(),
      now.getDate()
    );

    // Check if timestamp is within acceptable range
    return date >= startDate && date <= maxFutureDate;
  } catch {
    return false;
  }
}

/**
 * Validates that startTime is before or equal to endTime
 * @param {string|null|undefined} startTime - Start timestamp
 * @param {string|null|undefined} endTime - End timestamp
 * @returns {boolean} - True if valid order, false otherwise
 */
export function isValidTimeOrder(startTime, endTime) {
  // Handle missing timestamps gracefully
  if (!startTime || !endTime) {
    return true;
  }

  // Validate both timestamps first
  if (
    !validateTimestampFormat(startTime) ||
    !validateTimestampFormat(endTime)
  ) {
    return false;
  }

  try {
    const start = new Date(startTime);
    const end = new Date(endTime);

    return start <= end;
  } catch {
    return false;
  }
}

/**
 * Validates a single timewarrior entry
 * @param {object} entry - The entry to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export function validateEntry(entry) {
  // Check if entry exists and has required structure
  if (!entry || typeof entry !== "object") {
    return false;
  }

  // Check for required startTime field
  if (!entry.start) {
    return false;
  }

  // Validate timestamp formats
  if (!validateTimestampFormat(entry.start)) {
    return false;
  }

  if (entry.end && !validateTimestampFormat(entry.end)) {
    return false;
  }

  // Validate timestamp ranges
  if (!validateTimestampRange(entry.start)) {
    return false;
  }

  if (entry.end && !validateTimestampRange(entry.end)) {
    return false;
  }

  // Validate time order
  if (!isValidTimeOrder(entry.start, entry.end)) {
    return false;
  }

  return true;
}

/**
 * Filters out entries from "today" (incomplete data rule)
 * Uses Taipei timezone for determining "today"
 * @param {Array} entries - Array of entries to filter
 * @returns {Array} - Filtered entries (excluding today's entries)
 */
export function filterTodayEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  const today = new Date();
  const todayTaipei = convertToTaipeiTime(today.toISOString());
  const todayTaipeiDate = getTaipeiCalendarDate(todayTaipei);

  return entries.filter((entry) => {
    if (!entry || !entry.start) {
      return false; // Filter out invalid entries
    }

    try {
      // Convert entry start time to Taipei timezone and get calendar date
      const taipeiDateTime = convertToTaipeiTime(entry.start);
      const entryTaipeiDate = getTaipeiCalendarDate(taipeiDateTime);

      // Filter out entries from today in Taipei timezone
      return entryTaipeiDate !== todayTaipeiDate;
    } catch {
      return false; // Filter out entries with invalid dates
    }
  });
}

/**
 * Validates and filters an array of entries
 * @param {Array} entries - Array of entries to process
 * @returns {object} - Object with validEntries, filteredCount, invalidCount, errors
 */
export function validateEntries(entries) {
  const result = {
    validEntries: [],
    filteredCount: 0,
    invalidCount: 0,
    errors: [],
  };

  if (!Array.isArray(entries)) {
    return result;
  }

  const today = new Date();
  const todayTaipei = convertToTaipeiTime(today.toISOString());
  const todayTaipeiDate = getTaipeiCalendarDate(todayTaipei);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Check if entry is from today (incomplete data rule)
    if (entry && entry.start) {
      try {
        const taipeiDateTime = convertToTaipeiTime(entry.start);
        const entryTaipeiDate = getTaipeiCalendarDate(taipeiDateTime);
        if (entryTaipeiDate === todayTaipeiDate) {
          result.filteredCount++;
          result.errors.push(
            `Entry ${i + 1}: Filtered out (incomplete data from today)`
          );
          continue;
        }
      } catch {
        // If we can't determine the date, treat as invalid
      }
    }

    // Validate the entry
    if (validateEntry(entry)) {
      result.validEntries.push(entry);
    } else {
      result.invalidCount++;

      // Determine specific validation error
      let errorMessage = "Invalid entry";
      if (!entry || typeof entry !== "object") {
        errorMessage = "Entry is not a valid object";
      } else if (!entry.start) {
        errorMessage = "Missing required field: start";
      } else if (!validateTimestampFormat(entry.start)) {
        errorMessage = "Invalid timestamp format";
      } else if (entry.end && !validateTimestampFormat(entry.end)) {
        errorMessage = "Invalid timestamp format";
      } else if (
        !validateTimestampRange(entry.start) ||
        (entry.end && !validateTimestampRange(entry.end))
      ) {
        errorMessage = "Timestamp out of range";
      } else if (!isValidTimeOrder(entry.start, entry.end)) {
        errorMessage = "End time must be after start time";
      }

      result.errors.push(`Entry ${i + 1}: ${errorMessage}`);
    }
  }

  return result;
}
