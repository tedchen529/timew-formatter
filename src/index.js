#!/usr/bin/env node

import { createCommand } from "./cli/commands.js";

const program = createCommand();

// Error handling
program.exitOverride((err) => {
  if (err.code === "commander.unknownCommand") {
    console.error("Unknown command");
    process.exit(1);
  }
  throw err;
});

try {
  program.parse(process.argv);
} catch (err) {
  if (err.message.match(/database|connection|fail/i)) {
    console.error("Database connection failed.");
    process.exit(1);
  }
  if (err.message.match(/timewarrior|not found|missing/i)) {
    console.error("Timewarrior not found.");
    process.exit(1);
  }
  if (err.code === "commander.helpDisplayed") {
    process.exit(0);
  }
  console.error(err.message);
  process.exit(1);
}
