// Helper functions for managing projects in timewplus_projects table

/**
 * Parses an annotation string to extract project name and annotation
 * @param {string} fullAnnotation - The full annotation string
 * @returns {Object} - Object with projectName and annotation properties
 */
function parseAnnotation(fullAnnotation) {
  if (!fullAnnotation || typeof fullAnnotation !== "string") {
    return {
      projectName: "default",
      annotation: fullAnnotation || "",
    };
  }

  const dashIndex = fullAnnotation.indexOf("-");

  if (dashIndex === -1) {
    // No dash found, treat entire string as project name with empty annotation
    return {
      projectName: fullAnnotation.trim(),
      annotation: "",
    };
  }

  return {
    projectName: fullAnnotation.substring(0, dashIndex).trim(),
    annotation: fullAnnotation.substring(dashIndex + 1).trim(),
  };
}

/**
 * Gets or creates a project in the timewplus_projects table
 * @param {Object} client - PostgreSQL client instance
 * @param {string} projectName - Name of the project
 * @returns {Promise<number>} - Returns the project ID
 */
async function getOrCreateProject(client, projectName) {
  if (!projectName || projectName.trim() === "") {
    projectName = "default";
  }

  const trimmedProjectName = projectName.trim();

  try {
    // First, try to find existing project
    const existingProject = await client.query(
      'SELECT id FROM timewplus_projects WHERE "projectName" = $1',
      [trimmedProjectName]
    );

    if (existingProject.rows.length > 0) {
      return existingProject.rows[0].id;
    }

    // Project doesn't exist, create it
    const newProject = await client.query(
      'INSERT INTO timewplus_projects ("projectName", "description") VALUES ($1, $2) RETURNING id',
      [trimmedProjectName, `Auto-generated project for ${trimmedProjectName}`]
    );

    console.log(
      `Created new project: ${trimmedProjectName} with ID: ${newProject.rows[0].id}`
    );
    return newProject.rows[0].id;
  } catch (error) {
    console.error(
      `Error managing project "${trimmedProjectName}":`,
      error.message
    );
    throw error;
  }
}

/**
 * Processes an entry's annotation to get project ID and parsed annotation
 * @param {Object} client - PostgreSQL client instance
 * @param {string} fullAnnotation - The full annotation string from timew entry
 * @returns {Promise<Object>} - Object with projectId and annotation properties
 */
async function processEntryAnnotation(client, fullAnnotation) {
  const { projectName, annotation } = parseAnnotation(fullAnnotation);
  const projectId = await getOrCreateProject(client, projectName);

  return {
    projectId,
    annotation,
  };
}

module.exports = {
  parseAnnotation,
  getOrCreateProject,
  processEntryAnnotation,
};
