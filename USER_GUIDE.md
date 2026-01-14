# USER_GUIDE.md

## Overview

This CLI tool helps you fetch and process time tracking data from Timewarrior, storing it in a database and formatting it for further use. All commands are run via the `timewplus` CLI.

## Commands

### 1. `timewplus fetch all`

Fetches all missing logs from Timewarrior and imports them into the database. This command:

- Connects to the database
- Runs a Timewarrior export for all missing entries
- Processes and stores each entry
- Handles project annotations and formatting

**Use when:** You want to import all available time tracking data into your database.

---

### 2. `timewplus fetch YYYY-MM-DD`

Fetches and imports logs for a specific date only. This command:

- Connects to the database
- Runs a Timewarrior export for the given date
- Processes and stores entries for that date

**Use when:** You want to import or re-import data for a single day.

---

### 3. `timewplus fetch YYYY-MM-DD - YYYY-MM-DD`

Fetches and imports logs for a specific date range (inclusive). This command:

- Connects to the database
- Runs a Timewarrior export for the given date range
- Processes and stores entries for each day in the range

**Use when:** You want to import or re-import data for a range of days.

---

## Usage Examples

- Fetch all logs:  
  `timewplus fetch all`
- Fetch logs for January 1, 2025:  
  `timewplus fetch 2025-01-01`
- Fetch logs for January 1–7, 2025:  
  `timewplus fetch 2025-01-01 - 2025-01-07`

---

## Notes

- All commands require a working database connection (see your `.env` file for configuration).
- Date format must be `YYYY-MM-DD`.
- If you enter an invalid command or date, usage instructions will be shown.

For more details, see the code in `src/cli.js` and the business logic in `doc/business-logic.md`.
