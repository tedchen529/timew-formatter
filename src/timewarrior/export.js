import { exec } from "child_process";

/**
 * Validates if timewarrior is installed and accessible via WSL
 * @returns {Promise<{isInstalled: boolean, version?: string, error?: string}>}
 */
export async function validateTimewInstallation() {
  const command = "wsl timew --version";

  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve({
          isInstalled: false,
          error: error.message,
        });
        return;
      }

      if (stdout && stdout.includes("timewarrior")) {
        resolve({
          isInstalled: true,
          version: stdout.trim(),
        });
      } else {
        resolve({
          isInstalled: false,
          error: stderr || "Unknown timewarrior installation issue",
        });
      }
    });
  });
}

/**
 * Builds the timewarrior export command for WSL execution
 * @param {string} [startDate] - Start date in YYYY-MM-DD format
 * @param {string} [endDate] - End date in YYYY-MM-DD format
 * @returns {string} Complete WSL command
 */
export function buildTimewExportCommand(startDate, endDate) {
  let command = "wsl timew export";

  if (startDate && endDate) {
    // Date range export
    command += ` from ${startDate} to ${endDate}`;
  } else if (startDate) {
    // Single date export
    command += ` ${startDate}`;
  }

  return command;
}

/**
 * Executes a timewarrior export command
 * @param {string} command - The command to execute
 * @param {Object} [options] - Execution options
 * @param {number} [options.timeout] - Command timeout in milliseconds
 * @returns {Promise<{success: boolean, data?: string, error?: string, warnings?: string}>}
 */
export async function executeTimewExport(command, options = {}) {
  const { timeout = 30000 } = options;

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve({
        success: false,
        error: `Command timeout after ${timeout}ms`,
      });
    }, timeout);

    exec(command, (error, stdout, stderr) => {
      clearTimeout(timeoutId);

      if (error) {
        resolve({
          success: false,
          error: error.message,
        });
        return;
      }

      const result = {
        success: true,
        data: stdout,
      };

      // Include warnings if there's stderr but no error
      if (stderr && stderr.trim()) {
        result.warnings = stderr.trim();
      }

      resolve(result);
    });
  });
}

/**
 * Parses timewarrior JSON output and validates structure
 * @param {string} jsonOutput - Raw JSON output from timewarrior
 * @returns {{success: boolean, entries?: Array, error?: string}}
 */
export function parseTimewOutput(jsonOutput) {
  try {
    // Handle empty output
    if (!jsonOutput || jsonOutput.trim() === "") {
      return {
        success: true,
        entries: [],
      };
    }

    const parsed = JSON.parse(jsonOutput);

    // Ensure output is an array
    if (!Array.isArray(parsed)) {
      return {
        success: false,
        error: "Timewarrior output must be an array",
      };
    }

    // Validate entry structure
    for (const entry of parsed) {
      if (!entry.start) {
        return {
          success: false,
          error: "Invalid timewarrior entry structure: missing start time",
        };
      }
    }

    return {
      success: true,
      entries: parsed,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse JSON: ${error.message}`,
    };
  }
}

/**
 * Validates date format (YYYY-MM-DD)
 * @param {string} date - Date string to validate
 * @returns {boolean} True if valid
 */
function isValidDate(date) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return false;
  }

  // Parse date parts to avoid timezone issues
  const [year, month, day] = date.split("-").map(Number);

  // Check if the date components are valid
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Create date object and check if it represents the same date
  const dateObj = new Date(year, month - 1, day); // month is 0-based
  return (
    dateObj.getFullYear() === year &&
    dateObj.getMonth() === month - 1 &&
    dateObj.getDate() === day
  );
}

/**
 * Exports all timewarrior data
 * @returns {Promise<{success: boolean, entries?: Array, error?: string}>}
 */
export async function exportAllData() {
  try {
    const command = buildTimewExportCommand();
    const execResult = await executeTimewExport(command);

    if (!execResult.success) {
      return {
        success: false,
        error: execResult.error,
      };
    }

    const parseResult = parseTimewOutput(execResult.data);

    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error,
      };
    }

    return {
      success: true,
      entries: parseResult.entries,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Exports timewarrior data for a specific date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<{success: boolean, entries?: Array, error?: string}>}
 */
export async function exportDateRange(startDate, endDate) {
  // Validate date formats
  if (!isValidDate(startDate)) {
    return {
      success: false,
      error: "Invalid start date format. Expected YYYY-MM-DD",
    };
  }

  if (!isValidDate(endDate)) {
    return {
      success: false,
      error: "Invalid end date format. Expected YYYY-MM-DD",
    };
  }

  // Validate date order
  if (new Date(startDate) > new Date(endDate)) {
    return {
      success: false,
      error: "start date must be before or equal to end date",
    };
  }

  try {
    const command = buildTimewExportCommand(startDate, endDate);
    const execResult = await executeTimewExport(command);

    if (!execResult.success) {
      return {
        success: false,
        error: execResult.error,
      };
    }

    const parseResult = parseTimewOutput(execResult.data);

    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error,
      };
    }

    return {
      success: true,
      entries: parseResult.entries,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Exports timewarrior data for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<{success: boolean, entries?: Array, error?: string}>}
 */
export async function exportSingleDate(date) {
  // Validate date format
  if (!isValidDate(date)) {
    return {
      success: false,
      error: "Invalid date format. Expected YYYY-MM-DD",
    };
  }

  try {
    const command = buildTimewExportCommand(date);
    const execResult = await executeTimewExport(command);

    if (!execResult.success) {
      return {
        success: false,
        error: execResult.error,
      };
    }

    const parseResult = parseTimewOutput(execResult.data);

    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error,
      };
    }

    return {
      success: true,
      entries: parseResult.entries,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Main entry point for timewarrior data export with optional validation
 * @param {Object} [options] - Export options
 * @param {string} [options.startDate] - Start date for range export
 * @param {string} [options.endDate] - End date for range export
 * @param {boolean} [options.validateInstallation] - Whether to validate timewarrior installation first
 * @param {number} [options.retries] - Number of retries on failure
 * @returns {Promise<{success: boolean, entries?: Array, error?: string}>}
 */
export async function exportTimewarriorData(options = {}) {
  const {
    startDate,
    endDate,
    validateInstallation = false,
    retries = 0,
  } = options;

  // Validate installation if requested
  if (validateInstallation) {
    const installationCheck = await validateTimewInstallation();
    if (!installationCheck.isInstalled) {
      return {
        success: false,
        error:
          installationCheck.error ||
          "Timewarrior installation validation failed",
      };
    }
  }

  // Determine export type and execute
  let exportFunction;
  let exportArgs = [];

  if (startDate && endDate) {
    exportFunction = exportDateRange;
    exportArgs = [startDate, endDate];
  } else if (startDate) {
    exportFunction = exportSingleDate;
    exportArgs = [startDate];
  } else {
    exportFunction = exportAllData;
    exportArgs = [];
  }

  // Execute with retry logic
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await exportFunction(...exportArgs);
      if (result.success) {
        return result;
      }
      lastError = result.error;
    } catch (error) {
      lastError = error.message;
    }

    // Wait before retrying (exponential backoff)
    if (attempt < retries) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }

  return {
    success: false,
    error: lastError || "Export failed after retries",
  };
}
