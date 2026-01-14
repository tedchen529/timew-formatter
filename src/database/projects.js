/**
 * Project Resolution Module
 *
 * Handles database operations for projects including querying existing projects,
 * creating new projects, and ensuring project existence for foreign key relationships.
 */

/**
 * Validates that the database pool parameter is provided
 * @param {object} pool - Database connection pool
 * @throws {Error} If pool is null or undefined
 */
function validatePool(pool) {
  if (!pool) {
    throw new Error("Database pool is required");
  }
}

/**
 * Validates and normalizes project name
 * @param {string} projectName - The project name to validate
 * @returns {string} - Trimmed project name
 * @throws {Error} If project name is empty, null, or undefined
 */
function validateProjectName(projectName) {
  if (
    !projectName ||
    typeof projectName !== "string" ||
    projectName.trim() === ""
  ) {
    throw new Error("Project name cannot be empty");
  }
  return projectName.trim();
}

/**
 * Validates database response structure
 * @param {object} result - Database query result
 * @throws {Error} If result structure is invalid
 */
function validateDatabaseResponse(result) {
  if (!result || !Array.isArray(result.rows)) {
    throw new Error("Invalid database response");
  }
}

/**
 * Generates a consistent description for auto-generated projects
 * @param {string} projectName - The project name (not used in generation)
 * @returns {string} - Standard description for timewarrior imports
 */
export function generateProjectDescription(projectName) {
  return "Auto-generated project for timewarrior imports";
}

/**
 * Finds a project by its exact name (case-sensitive)
 * @param {object} pool - Database connection pool
 * @param {string} projectName - The project name to search for
 * @returns {object|null} - Project object if found, null otherwise
 * @throws {Error} For database errors or invalid parameters
 */
export async function findProjectByName(pool, projectName) {
  validatePool(pool);
  const normalizedName = validateProjectName(projectName);

  try {
    const result = await pool.query(
      'SELECT * FROM timewplus_projects WHERE "projectName" = $1',
      [normalizedName]
    );

    validateDatabaseResponse(result);

    if (result.rowCount === 0) {
      return null;
    }

    if (result.rowCount > 1) {
      throw new Error("Multiple projects found with same name");
    }

    return result.rows[0];
  } catch (error) {
    // Re-throw validation errors as-is
    if (
      error.message.includes("Multiple projects") ||
      error.message.includes("Invalid database response")
    ) {
      throw error;
    }
    // Re-throw database errors as-is for proper error handling
    throw error;
  }
}

/**
 * Creates a new project with optional custom description
 * @param {object} pool - Database connection pool
 * @param {string} projectName - The name of the project to create
 * @param {string} [description] - Optional custom description
 * @returns {object} - Created project object
 * @throws {Error} For database errors, validation failures, or duplicates
 */
export async function createProject(pool, projectName, description = null) {
  validatePool(pool);
  const normalizedName = validateProjectName(projectName);

  // Validate project name length
  if (normalizedName.length > 255) {
    throw new Error("Project name exceeds maximum length of 255 characters");
  }

  const projectDescription =
    description || generateProjectDescription(normalizedName);

  try {
    const result = await pool.query(
      'INSERT INTO timewplus_projects ("projectName", "description") VALUES ($1, $2) RETURNING *',
      [normalizedName, projectDescription]
    );

    validateDatabaseResponse(result);

    if (result.rowCount === 0) {
      throw new Error("Failed to create project");
    }

    return result.rows[0];
  } catch (error) {
    // Handle PostgreSQL unique constraint violation
    if (
      error.code === "23505" &&
      error.message.includes("timewplus_projects_projectName_key")
    ) {
      throw new Error(`Project "${normalizedName}" already exists`);
    }

    // Re-throw other errors as-is
    throw error;
  }
}

/**
 * Ensures a project exists, creating it if necessary
 * @param {object} pool - Database connection pool
 * @param {string} projectName - The project name to ensure exists
 * @returns {object} - Project object with guaranteed ID for foreign key use
 * @throws {Error} For database errors or validation failures
 */
export async function ensureProjectExists(pool, projectName) {
  validatePool(pool);
  const normalizedName = validateProjectName(projectName);

  try {
    // First, try to find existing project
    const existingProject = await findProjectByName(pool, normalizedName);

    if (existingProject) {
      return existingProject;
    }

    // Project doesn't exist, create it
    const newProject = await createProject(pool, normalizedName);
    return newProject;
  } catch (error) {
    // Handle the case where project was created concurrently
    if (error.message.includes(`Project "${normalizedName}" already exists`)) {
      throw error;
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Retrieves all projects ordered by creation date
 * @param {object} pool - Database connection pool
 * @returns {Array} - Array of all project objects
 * @throws {Error} For database errors
 */
export async function getAllProjects(pool) {
  validatePool(pool);

  try {
    const result = await pool.query(
      "SELECT * FROM timewplus_projects ORDER BY created_at ASC"
    );

    validateDatabaseResponse(result);

    return result.rows;
  } catch (error) {
    // Re-throw database errors as-is
    throw error;
  }
}
