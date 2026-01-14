# Database Schema Documentation

## Database: timewplus_db

### Table: timewplus_projects

Stores project information for categorizing time entries.

```sql
CREATE TABLE timewplus_projects (
    id SERIAL PRIMARY KEY,
    "projectName" VARCHAR(255) NOT NULL UNIQUE,
    "description" TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Fields:**

- `id`: Auto-incrementing primary key
- `projectName`: Unique project identifier, case-sensitive
- `description`: Optional project description (auto-generated for timewarrior imports)
- `created_at`: Record creation timestamp
- `updated_at`: Last modification timestamp

**Business Rules:**

- Project names are automatically extracted from timewarrior annotations
- Default project "default" exists for entries without project annotations
- Names are trimmed of whitespace but preserve case sensitivity

### Table: timewplus_entries

Stores individual time tracking entries with enhanced categorization.

```sql
CREATE TABLE timewplus_entries (
    id SERIAL PRIMARY KEY,
    "startTime" TIMESTAMP NOT NULL,
    "endTime" TIMESTAMP,
    "sessionName" VARCHAR(255),
    "projectId" INTEGER REFERENCES timewplus_projects(id),
    "annotation" TEXT,
    "groupType" VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Fields:**

- `id`: Auto-incrementing primary key
- `startTime`: Entry start timestamp (required, from timewarrior)
- `endTime`: Entry end timestamp (optional for ongoing entries)
- `sessionName`: Session identifier (from timewarrior tags[0])
- `projectId`: Foreign key to timewplus_projects table
- `annotation`: Parsed annotation text (project name removed)
- `groupType`: User-assigned category for date grouping (required)
- `created_at`: Record creation timestamp
- `updated_at`: Last modification timestamp

**Indexes:**

```sql
CREATE INDEX idx_timewplus_entries_starttime ON timewplus_entries("startTime");
CREATE INDEX idx_timewplus_entries_endtime ON timewplus_entries("endTime");
CREATE INDEX idx_timewplus_entries_projectid ON timewplus_entries("projectId");
CREATE INDEX idx_timewplus_entries_grouptype ON timewplus_entries("groupType");
```

**Business Rules:**

- `startTime` cannot be null (validation in application layer)
- `groupType` must be provided via user input during import
- `projectId` automatically resolved from annotation parsing
- Duplicate prevention based on date range queries
- Timezone stored as UTC, converted to Taipei time for display/grouping

## Relationships

- **One-to-Many**: projects → entries (one project can have multiple entries)
- **Foreign Key Constraint**: entries.projectId references projects.id

## Data Integrity Constraints

1. **Temporal Consistency**: startTime should be before or equal to endTime
2. **Project Reference**: All entries must reference valid project
3. **Group Type Requirement**: No entries allowed without groupType
4. **Duplicate Prevention**: Application-level constraint prevents overlapping imports

## Environment Configuration

Required environment variables:

- `DB_USER`: PostgreSQL username
- `DB_PASS`: PostgreSQL password
- `DB_NAME`: Database name (timewplus_db)
- `START_DATE`: Initial import start date (YYYY-MM-DD format)
- `PORT`: Application port (default: 3000)
