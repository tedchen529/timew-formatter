# Timewplus: AI Coding Agent Instructions

## Source of Truth

- **Specs First:** All business logic is defined in `/doc/business-logic.md`. Never contradict or bypass these rules.
- **Database constraints** are in `/doc/database-schema.md`. All DB code must enforce these constraints and relationships.

## Architecture Overview

- **CLI tool** (`src/cli.js`) bridges Timewarrior (via WSL) and a PostgreSQL database.
- **Actions** (`src/actions/`) implement core commands: `fetchAll`, `fetchDateRange` (import time entries), and soon `analyze` (aggregate/report data).
- **Project/annotation parsing** is handled in `src/utils/projectManager.js`.
- **Express server** (`src/index.js`) is for future API/automation, not core CLI workflows.

## Data Flow

1. **Import**: CLI runs `timew export` in WSL, parses JSON, converts UTC→Taipei, groups by date, prompts user for `groupType` per date.
2. **Project assignment**: Project name is parsed from annotation (see `/doc/business-logic.md` for rules). If not found, project is `DEFAULT`.
3. **DB Insert**: Prevents duplicate entries by checking for existing data in the date range. All inserts require a valid `groupType` and project.
4. **Analysis**: (Planned) Aggregates time by session and project for a date/range.

## Developer Workflow

- **TDD First**: Write failing tests (Vitest, see `test/`) before implementation. Do not skip this step.
- **SDD First**: If a requirement is unclear or missing, request a doc update before coding.
- **Run CLI**: `node src/cli.js fetch all` or `timewplus fetch YYYY-MM-DD [- YYYY-MM-DD]` (see usage in `src/cli.js`).
- **Environment**: Requires `.env` with `DB_USER`, `DB_PASS`, `DB_NAME`, `START_DATE`, `PORT`.
- **Testing**: Use Vitest. CLI is tested via `spawnSync` (see `test/cli.test.js`).

## Project Conventions

- **Timezone**: All times stored as UTC, grouped/displayed as Taipei (UTC+8).
- **Annotation Parsing**: Project is all-caps prefix before dash, else `DEFAULT`.
- **Group Type**: User must provide for each date during import.
- **No Today Import**: Never import today's data (to avoid incomplete entries).
- **No duplicate imports**: Block insertion if any entry exists in the date range.

## Examples

- To add a new CLI command, follow the pattern in `src/cli.js` and implement logic in `src/actions/`.
- To add a new DB field, update `/doc/database-schema.md` and all relevant queries in `src/actions/`.

## Key Files

- `/doc/business-logic.md` — business rules, workflows, CLI specs
- `/doc/database-schema.md` — DB schema, constraints, env vars
- `src/cli.js` — CLI entrypoint, command parsing
- `src/actions/` — main business logic (import, fetch, analyze)
- `src/utils/projectManager.js` — project/annotation parsing, DB helpers
- `test/` — Vitest test suites for CLI and logic
