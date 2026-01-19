# Task Breakdown: Analyzer Feature for Existing Time Entry Data

## Overview

This document outlines the steps required to implement the `timewplus analyze` feature as described in the business logic and database schema documentation. All steps follow TDD (Test-Driven Development) and SDD (Specification-Driven Development) principles.

---

## 1. Specification & Design

1. **Review Business Logic & Schema**

   - Ensure all requirements from `/doc/business-logic.md` and `/doc/database-schema.md` are clear and complete.
   - If any requirement is ambiguous or missing, request clarification and update documentation before proceeding.

2. **CLI Command Design**
   - Define CLI syntax: `timewplus analyze YYYY-MM-DD` and `timewplus analyze YYYY-MM-DD - YYYY-MM-DD`.
   - Specify expected output format for both session and project aggregations (fields, order, percentage calculation, etc).

---

## 2. Test-Driven Development (TDD)

3. **Write Failing Tests**
   - Add tests for CLI command parsing and argument validation.
   - Add tests for database query logic:
     - Aggregation by `sessionName` (total time, percentage, descending order).
     - Aggregation by `projectId` (resolve project name, total time, descending order).
   - Add tests for output formatting (correct order, correct percentage, correct project/session names).
   - Add tests for edge cases:
     - No entries in range
     - Entries with missing/NULL `endTime`
     - Entries with missing/NULL `sessionName` or `projectId`
     - Overlapping or ongoing entries

---

## 3. Implementation

4. **Implement CLI Command**

   - Add `analyze` command to CLI (Commander.js integration).
   - Parse and validate date or date range arguments.

5. **Database Query Logic**

   - Query `timewplus_entries` for entries in the specified date range.
   - Aggregate total time per `sessionName` and per `projectId`.
   - Join with `timewplus_projects` to resolve project names.
   - Calculate total time and percentage for each group.
   - Sort results in descending order by time spent.

6. **Output Formatting**
   - Format and display results as specified in the business logic.
   - Show time, percentage, and names in correct order.

---

## 4. Validation & Review

7. **Run Tests**

   - Ensure all new and existing tests pass.

8. **Code Review**

   - Review implementation for adherence to business logic, schema, and code quality standards.

9. **Documentation**
   - Update user guide and developer docs to describe the new feature and its usage.

---

## 5. Deployment

10. **Release**
    - Merge feature branch after successful review and testing.
    - Announce feature in changelog/user guide.

---

## Notes

- Do not implement any code until all tests for the feature are written and failing (TDD).
- If any requirement is unclear, update `/doc/business-logic.md` or `/doc/database-schema.md` before proceeding (SDD).
