# Time Tracking CLI Tool - Business Logic Specification

## Overview

This is a CLI tool, it bridges Timewarrior data with a PostgreSQL database, expanding the capabilities beyond Timewarrior's native features. To store, categorize, and analyze time entries more effectively.

## Core Business Rules

### 1. Data Source Integration

It takes the data from WSL's installation of Timewarrior on the local machine. It uses `timew export` command to export time tracking data in JSON format. It Convert UTC timestamps to Taipei time (UTC+8)

### 2. Project Assigning

For each time entry, a Project is assigned. The Project and annotation is based on the annotation field of the time entry. entries without annotations will have `DEFAULT` project. if it has annotation, it checks the from the beginning of the line, should be CAPITALIZED LETTERS, until it reaches the first dash `-`. This is the project name. whatever comes after it is the annotation. for example `LEARNING-Learning Java` means that the project is `LEARNING` and the annotation is `Learning Java`. If no dash is found or eveything before the dash is not CAPITALIZED LETTERS, THE whole annotation is used as annotation and project is `DEFAULT`.

### 3. Entry Processing Rules

When trying to insert entries into teh database, the following rules apply:

Block insertion if entries already exist in specified date range. if there exists entries in that date range, blocck the insertion process.
When inserting, each date (a day in Taipei timezone) reuires a manual assignment of something called `groupType`, which will be entered in the CLI.

### 4. CLI Commands

- `fetch all`: Import all missing entries from START_DATE to yesterday
- `fetch YYYY-MM-DD`: Import entries for specific date
- `fetch YYYY-MM-DD - YYYY-MM-DD`: Import entries for date range

### 5. Operational Constraints

- **Today Exclusion**: Never import today's data to avoid incomplete entries

## Business Workflows

### Initial Setup Workflow

1. Check database for existing entries
2. If empty, fetch from START_DATE to yesterday
3. Group entries by Taipei date
4. Prompt user for group type per date
5. Process annotations and create projects
6. Insert entries

### Incremental Update Workflow

1. Find latest entry timestamp
2. Fetch timewarrior data from that point to yesterday
3. Follow same grouping and insertion process
4. Maintain data integrity through duplicate prevention

### Project Resolution Workflow

1. Parse annotation for project name (before first dash)
2. Check if project exists in database
3. Create project if not found with auto-generated description
4. Return project ID for entry association
