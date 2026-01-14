# Development Tasks - Time Tracking CLI Tool

## Phase 1: Project Setup & Database Foundation

### Task 1.1: Initialize Node.js Project with ESM

- [ ] Create package.json with ESM configuration (`"type": "module"`)
- [ ] Install dependencies: `commander`, `pg` (PostgreSQL client), `dotenv`
- [ ] Install dev dependencies: `vitest`, `@types/pg`
- [ ] Configure Vitest in package.json with ESM support
- [ ] Create `.env.example` file with required environment variables

### Task 1.2: Database Connection Module

- [ ] **Test First**: Write tests for database connection in `tests/database.test.js`
- [ ] Create `src/database/connection.js` with PostgreSQL connection pool
- [ ] Validate environment variables (DB_USER, DB_PASS, DB_NAME, START_DATE, PORT)
- [ ] Implement connection testing function
- [ ] Add graceful connection closing

### Task 1.3: Database Schema Setup

- [ ] **Test First**: Write tests for schema creation in `tests/schema.test.js`
- [ ] Create `src/database/schema.js` with table creation functions
- [ ] Implement `timewplus_projects` table creation
- [ ] Implement `timewplus_entries` table creation
- [ ] Add required indexes creation
- [ ] Create default project record ("DEFAULT")

## Phase 2: Timewarrior Integration

### Task 2.1: Timewarrior Export Module

- [ ] **Test First**: Write tests for timewarrior export in `tests/timewarrior.test.js`
- [ ] Create `src/timewarrior/export.js` to execute `timew export` command
- [ ] Parse JSON output from timewarrior
- [ ] Handle WSL command execution
- [ ] Add error handling for missing timewarrior installation

### Task 2.2: Timezone Conversion Module

- [ ] **Test First**: Write tests for timezone conversion in `tests/timezone.test.js`
- [ ] Create `src/utils/timezone.js` for UTC to Taipei conversion
- [ ] Convert startTime and endTime to Taipei timezone
- [ ] Group entries by Taipei calendar date
- [ ] Calculate date boundaries for filtering

### Task 2.3: Data Filtering & Validation

- [ ] **Test First**: Write tests for data validation in `tests/validation.test.js`
- [ ] Create `src/utils/validation.js` for entry validation
- [ ] Filter out entries from "today" (incomplete data rule)
- [ ] Validate timestamp formats and ranges
- [ ] Ensure startTime <= endTime when both exist

## Phase 3: Project & Annotation Processing

### Task 3.1: Annotation Parser

- [ ] **Test First**: Write tests for annotation parsing in `tests/parser.test.js`
- [ ] Create `src/parsers/annotation.js` for project extraction
- [ ] Parse text before first dash `-` character
- [ ] Validate CAPITALIZED LETTERS only for project names
- [ ] Split into project name and cleaned annotation
- [ ] Handle fallback to DEFAULT project

### Task 3.2: Project Resolution Module

- [ ] **Test First**: Write tests for project resolution in `tests/projects.test.js`
- [ ] Create `src/database/projects.js` for project operations
- [ ] Query existing projects by projectName
- [ ] Create new projects with auto-generated descriptions
- [ ] Return project IDs for foreign key assignment
- [ ] Handle case-sensitive project name uniqueness

## Phase 4: Database Operations

### Task 4.1: Duplicate Detection

- [ ] **Test First**: Write tests for duplicate detection in `tests/duplicates.test.js`
- [ ] Create `src/database/duplicates.js` for overlap checking
- [ ] Query entries within specified date ranges
- [ ] Block insertion if ANY overlap exists
- [ ] Return specific error messages for blocked operations

### Task 4.2: Entry Insertion Module

- [ ] **Test First**: Write tests for entry insertion in `tests/entries.test.js`
- [ ] Create `src/database/entries.js` for entry operations
- [ ] Implement transaction-based batch insertion
- [ ] Map timewarrior fields to database columns
- [ ] Handle sessionName from tags[0] array element
- [ ] Add rollback capability for failed insertions

## Phase 5: CLI Interface

### Task 5.1: CLI Command Structure

- [ ] **Test First**: Write tests for CLI commands in `tests/cli.test.js`
- [ ] Create `src/cli/commands.js` using Commander.js
- [ ] Implement `fetch all` command (START_DATE to yesterday)
- [ ] Implement `fetch YYYY-MM-DD` command (single date)
- [ ] Implement `fetch YYYY-MM-DD YYYY-MM-DD` command (date range)
- [ ] Add help text and usage examples

### Task 5.2: User Input Handling

- [ ] **Test First**: Write tests for user prompts in `tests/prompts.test.js`
- [ ] Create `src/cli/prompts.js` for interactive input
- [ ] Prompt user for groupType per unique date
- [ ] Validate groupType is not empty/null
- [ ] Handle Ctrl+C gracefully during prompts
- [ ] Display date context for user decisions

### Task 5.3: Main CLI Entry Point

- [ ] **Test First**: Write tests for main CLI in `tests/main.test.js`
- [ ] Create `src/index.js` as main entry point
- [ ] Wire together all modules and workflows
- [ ] Add command-line argument parsing
- [ ] Implement error handling and user feedback
- [ ] Add logging for debugging purposes

## Phase 6: Business Workflows

### Task 6.1: Initial Setup Workflow

- [ ] **Test First**: Write tests for initial setup in `tests/workflows/initial.test.js`
- [ ] Create `src/workflows/initial.js` for first-time setup
- [ ] Check database for existing entries (count = 0)
- [ ] Fetch from START_DATE to yesterday
- [ ] Process all unique dates for groupType assignment
- [ ] Execute full import with validation

### Task 6.2: Incremental Update Workflow

- [ ] **Test First**: Write tests for incremental updates in `tests/workflows/incremental.test.js`
- [ ] Create `src/workflows/incremental.js` for ongoing updates
- [ ] Query maximum timestamp from entries table
- [ ] Fetch from (max_timestamp + 1 day) to yesterday
- [ ] Apply duplicate prevention before processing
- [ ] Handle empty result sets gracefully

## Phase 7: Integration & Testing

### Task 7.1: End-to-End Testing

- [ ] **Test First**: Write integration tests in `tests/integration/e2e.test.js`
- [ ] Test complete workflow from timewarrior to database
- [ ] Mock timewarrior export command for testing
- [ ] Test error scenarios and rollback behavior
- [ ] Verify timezone conversion accuracy

### Task 7.2: Error Handling & Recovery

- [ ] **Test First**: Write tests for error scenarios in `tests/error-handling.test.js`
- [ ] Handle missing timewarrior installation
- [ ] Handle database connection failures
- [ ] Handle malformed JSON from timewarrior
- [ ] Add user-friendly error messages
- [ ] Implement retry logic where appropriate

### Task 7.3: Performance & Optimization

- [ ] **Test First**: Write performance tests in `tests/performance.test.js`
- [ ] Optimize batch insertion for large datasets
- [ ] Add connection pooling configuration
- [ ] Implement progress indicators for long operations
- [ ] Test with realistic data volumes

## Phase 8: Documentation & Deployment

### Task 8.1: Usage Documentation

- [ ] Create README.md with installation instructions
- [ ] Document CLI command examples
- [ ] Add troubleshooting section
- [ ] Document environment setup requirements

### Task 8.2: Final Integration Testing

- [ ] Test on clean database installation
- [ ] Verify all business rules are enforced
- [ ] Test date range boundary conditions
- [ ] Validate timezone conversion edge cases
- [ ] Confirm transaction rollback scenarios

## Development Guidelines

- **TDD Rule**: No implementation without failing tests first
- **SDD Rule**: Request specification updates for unclear requirements
- **Module Structure**: Use ESM imports/exports throughout
- **Error Handling**: All functions must handle and propagate errors appropriately
- **Transaction Safety**: Database operations must be atomic where specified
- **Timezone Consistency**: Always use Taipei timezone for date calculations
