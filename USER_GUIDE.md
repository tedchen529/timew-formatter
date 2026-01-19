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

### 4. `timewplus analyze <startDate> [ - <endDate> ]`

Analyzes time entries for a given date or date range, aggregating and summarizing time spent by session and by project. The output includes total time, percentage of total, and highlights ongoing or unknown entries.

- Aggregates by session name and by project
- Calculates total and percentage time for each group
- Handles ongoing entries (missing end time), unknown sessions/projects, and overlapping entries
- Sorts results by time spent (descending)

**Use when:** You want to see a summary of how your time was spent for a specific day or range, broken down by session and project.

#### Example Output

```
By Session:
  SessionA  2h 0m  66.7%
  SessionB  1h 0m  33.3%

By Project:
  ProjectX  2h 0m  66.7%
  ProjectY  1h 0m  33.3%
```

#### Usage Examples

- Analyze a single day:
  `timewplus analyze 2025-01-01`
- Analyze a date range:
  `timewplus analyze 2025-01-01 - 2025-01-07`

---

## Usage Examples

- Fetch all logs:
  `timewplus fetch all`
- Fetch logs for January 1, 2025:
  `timewplus fetch 2025-01-01`
- Fetch logs for January 1–7, 2025:
  `timewplus fetch 2025-01-01 - 2025-01-07`
- Analyze logs for January 1, 2025:
  `timewplus analyze 2025-01-01`
- Analyze logs for January 1–7, 2025:
  `timewplus analyze 2025-01-01 - 2025-01-07`

---

## Notes

- All commands require a working database connection (see your `.env` file for configuration).
- Date format must be `YYYY-MM-DD`.
- If you enter an invalid command or date, usage instructions will be shown.

For more details, see the code in `src/cli.js` and the business logic in `doc/business-logic.md`.
