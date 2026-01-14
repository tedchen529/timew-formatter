import { Command } from "commander";

/**
 * Creates and configures the main CLI program
 * @returns {Command} The configured Commander program
 */
export function createCommand() {
  const program = new Command();

  program
    .name("timew-formatter")
    .description(
      "CLI tool to bridge Timewarrior data with PostgreSQL database for enhanced time tracking analysis"
    )
    .version("1.0.0")
    .configureHelp({
      helpWidth: 120,
      sortSubcommands: true,
    });

  // Add the fetch command
  program
    .command("fetch")
    .description(
      "Fetch time entries from Timewarrior and import into database\n" +
        "Supports: 'all', single date (YYYY-MM-DD), or date range (YYYY-MM-DD YYYY-MM-DD)"
    )
    .argument(
      "[dateOrRange...]",
      "Date specification: 'all', 'YYYY-MM-DD', or 'YYYY-MM-DD YYYY-MM-DD'"
    )
    .action(async (args) => {
      try {
        const parsedArgs = parseArgs(["fetch", ...args]);

        if (args.length === 1 && args[0] === "all") {
          // Use initial setup workflow for 'fetch all'
          const { runInitialSetup } = await import("../workflows/initial.js");
          await runInitialSetup({
            startDate: parsedArgs.startDate,
            endDate: parsedArgs.endDate,
          });
          console.log("Imported all timewarrior data successfully.");
        } else {
          // Use incremental update workflow for specific dates
          const { runIncrementalUpdate } = await import(
            "../workflows/incremental.js"
          );
          await runIncrementalUpdate({
            startDate: parsedArgs.startDate,
            endDate: parsedArgs.endDate,
          });
        }
      } catch (error) {
        console.error(`Error: ${error.message}`);
        if (process.env.NODE_ENV !== "test") {
          process.exit(1);
        } else {
          throw error;
        }
      }
    });

  // Override helpInformation to include examples for testing
  // and use addHelpText for actual CLI display
  program.addHelpText(
    "after",
    `

Examples:
  $ timew-formatter fetch all                           Fetch from START_DATE to yesterday
  $ timew-formatter fetch 2024-03-15                   Fetch entries for a specific date
  $ timew-formatter fetch 2024-03-01 2024-03-15       Fetch entries for a date range`
  );

  // Override helpInformation to include additional help text for testing
  const originalHelpInformation = program.helpInformation.bind(program);
  program.helpInformation = function () {
    return (
      originalHelpInformation() +
      `

Examples:
  $ timew-formatter fetch all                           Fetch from START_DATE to yesterday
  $ timew-formatter fetch 2024-03-15                   Fetch entries for a specific date
  $ timew-formatter fetch 2024-03-01 2024-03-15       Fetch entries for a date range`
    );
  };

  return program;
}

/**
 * Parses and validates command line arguments
 * @param {string[]} args - Command line arguments
 * @returns {Object} Parsed arguments with startDate and endDate
 */
export function parseArgs(args) {
  if (args.length < 2) {
    throw new Error("Missing required arguments for fetch command");
  }

  const command = args[0];
  if (command !== "fetch") {
    throw new Error(`Unknown command: ${command}`);
  }

  const fetchArgs = args.slice(1);

  if (fetchArgs.length === 0) {
    throw new Error("Missing required arguments for fetch command");
  }

  if (fetchArgs.length > 2) {
    throw new Error("Too many arguments for fetch command");
  }

  // Handle 'fetch all' command
  if (fetchArgs.length === 1 && fetchArgs[0] === "all") {
    const startDate = process.env.START_DATE;
    if (!startDate) {
      throw new Error("START_DATE environment variable is required");
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const endDate = yesterday.toISOString().split("T")[0];

    return { startDate, endDate };
  }

  // Handle single date: fetch YYYY-MM-DD
  if (fetchArgs.length === 1) {
    const date = fetchArgs[0];
    validateDate(date);
    validateNotFuture(date);

    return { startDate: date, endDate: date };
  }

  // Handle date range: fetch YYYY-MM-DD YYYY-MM-DD
  if (fetchArgs.length === 2) {
    const [startDate, endDate] = fetchArgs;

    validateDate(startDate);
    validateDate(endDate);
    validateNotFuture(endDate);

    if (new Date(startDate) > new Date(endDate)) {
      throw new Error("End date must be after start date");
    }

    return { startDate, endDate };
  }

  throw new Error("Missing required arguments for fetch command");
}

/**
 * Validates date format (YYYY-MM-DD)
 * @param {string} dateString - Date string to validate
 */
function validateDate(dateString) {
  // Check format using regex
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    throw new Error(`Invalid date format: ${dateString}`);
  }

  // Check if it's a valid date
  const date = new Date(dateString);
  const [year, month, day] = dateString.split("-").map(Number);

  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    throw new Error(`Invalid date format: ${dateString}`);
  }
}

/**
 * Validates that date is not in the future
 * @param {string} dateString - Date string to validate
 */
function validateNotFuture(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison

  if (date >= today) {
    throw new Error("Cannot fetch data from future dates");
  }
}
