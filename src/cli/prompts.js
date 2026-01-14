import readline from "readline";

/**
 * Prompts the user for a groupType for a specific date
 * @param {string} date - The date to prompt for (YYYY-MM-DD format)
 * @param {readline.Interface} [rl] - Optional readline interface (for testing)
 * @returns {Promise<string>} - The validated groupType
 */
export async function promptForGroupType(date, rl = null) {
  const useProvidedInterface = rl !== null;

  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  // Set up interruption handling if we created the interface
  if (!useProvidedInterface) {
    handlePromptInterruption(rl);
  }

  return new Promise((resolve) => {
    const askForInput = () => {
      rl.question(`Enter groupType for date ${date}: `, (input) => {
        const trimmedInput = input?.trim();

        if (!trimmedInput || trimmedInput === "") {
          console.error(
            "Error: groupType cannot be empty or null. Please enter a valid groupType."
          );
          askForInput();
          return;
        }

        if (!useProvidedInterface) {
          rl.close();
        }
        resolve(trimmedInput);
      });
    };

    askForInput();
  });
}

/**
 * Prompts the user for groupTypes for multiple dates
 * @param {string[]} dates - Array of dates to prompt for
 * @param {readline.Interface} [rl] - Optional readline interface (for testing)
 * @returns {Promise<Object>} - Object mapping dates to groupTypes
 */
export async function promptForMultipleGroupTypes(dates, rl = null) {
  if (!dates || dates.length === 0) {
    return {};
  }

  const useProvidedInterface = rl !== null;

  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  // Set up interruption handling if we created the interface
  if (!useProvidedInterface) {
    handlePromptInterruption(rl);
  }

  const results = {};

  try {
    for (const date of dates) {
      const groupType = await promptForGroupType(date, rl);
      results[date] = groupType;
    }

    if (!useProvidedInterface) {
      rl.close();
    }

    return results;
  } catch (error) {
    if (!useProvidedInterface) {
      rl.close();
    }
    throw error;
  }
}

/**
 * Sets up graceful handling of Ctrl+C interruption
 * @param {readline.Interface} rl - The readline interface to handle
 */
export function handlePromptInterruption(rl) {
  rl.on("SIGINT", () => {
    console.log("\n\nOperation interrupted by user. Exiting gracefully...");
    rl.close();
    process.exit(0);
  });
}
