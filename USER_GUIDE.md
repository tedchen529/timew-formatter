# Timew-Formatter User Guide

This guide explains how to use the three main scripts in this project: `formatter.js`, `analyzer.js`, and `check.js`. Each script provides different functionality for processing, analyzing, and checking your time tracking data.

---

## 1. Formatting Raw Timewarrior Data (`formatter.js`)

**Purpose:**

- Converts raw Timewarrior JSON data into a clean, standardized format for further analysis.

**Usage:**

```bash
node formatter.js <raw-filename>
```

- `<raw-filename>`: The name of the raw JSON file (e.g., `timew_20251030.json`) located in `json/raw/`.

**What it does:**

- Reads the specified file from `json/raw/`.
- Outputs a cleaned file to `json/clean/` (e.g., `timew_clean_20251030.json`).
- Prints the reformatted data to the console.

**Example:**

```bash
node formatter.js timew_20251030.json
```

---

## 2. Analyzing Time Data (`analyzer.js`)

**Purpose:**

- Aggregates and analyzes cleaned time data by session, project, and category.
- Supports filtering by date range and day type.
- Can export results to a JSON file.

**Usage:**

```bash
# Analyze a single date
node analyzer.js YYYY-MM-DD [export]

# Analyze a date range
node analyzer.js YYYY-MM-DD - YYYY-MM-DD [export]

# Filter by day type (for date ranges only)
node analyzer.js YYYY-MM-DD - YYYY-MM-DD [export] just <dayType1> [dayType2] ...
```

- `[export]`: Optional. If included, exports results to `json/results/`.
- `just <dayType>`: Optional. Filter results to specific day types (e.g., `workday`).

**Examples:**

```bash
node analyzer.js 2025-10-30
node analyzer.js 2025-10-30 export
node analyzer.js 2025-10-27 - 2025-10-29
node analyzer.js 2025-10-27 - 2025-10-29 export
node analyzer.js 2025-10-27 - 2025-10-29 just workday
node analyzer.js 2025-10-27 - 2025-10-29 export just workday workday-outlier
```

**Notes:**

- Day type filtering is only available for date ranges, not single dates.
- Results are printed to the console and optionally exported as JSON.

---

## 3. Checking Categories and Projects (`check.js`)

**Purpose:**

- Checks for uncategorized session names.
- Lists all projects and their activity periods.
- Shows detailed stats for a specific project.

**Usage:**

```bash
# Check for uncategorized sessions
node check.js categories

# List all projects
node check.js projects

# Show details for a specific project
node check.js projects <project-name>
```

**Examples:**

```bash
node check.js categories
node check.js projects
node check.js projects "My Project"
```

**What it does:**

- `categories`: Lists session names in your data that are not assigned to any category in `categories.json`.
- `projects`: Lists all projects, total time, and active periods, sorted by most recent activity.
- `projects <project-name>`: Shows total time, entry count, date range, and daily breakdown for the specified project.

---

## Directory Structure

- `json/raw/`: Raw Timewarrior JSON files.
- `json/clean/`: Cleaned and reformatted JSON files.
- `json/results/`: Exported analysis results.
- `json/settings/categories.json`: Category definitions for sessions.

---

## Troubleshooting

- Ensure you have Node.js installed.
- Run commands from the project root directory.
- If you see file not found or invalid JSON errors, check your input filenames and file contents.

---

For further customization, edit the scripts or the `categories.json` file as needed.
