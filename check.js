const fs = require("fs");
const path = require("path");

function checkCategories() {
  // Read categories.json
  const categoriesPath = path.join(
    __dirname,
    "json",
    "settings",
    "categories.json"
  );
  let categories = {};

  try {
    const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, "utf8"));
    // Flatten the categories object to get all session names
    for (const categoryData of categoriesData) {
      for (const [categoryName, sessionNames] of Object.entries(categoryData)) {
        for (const sessionName of sessionNames) {
          categories[sessionName] = categoryName;
        }
      }
    }
  } catch (error) {
    console.error("Error reading categories.json:", error.message);
    return;
  }

  // Read all clean JSON files
  const cleanDir = path.join(__dirname, "json", "clean");
  let allSessionNames = new Set();

  try {
    const files = fs.readdirSync(cleanDir);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    for (const file of jsonFiles) {
      const filePath = path.join(cleanDir, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

        // Extract session names from each entry
        for (const entry of data) {
          if (entry.session_name) {
            allSessionNames.add(entry.session_name);
          }
        }
      } catch (error) {
        console.error(`Error reading ${file}:`, error.message);
      }
    }
  } catch (error) {
    console.error("Error reading clean directory:", error.message);
    return;
  }

  // Find session names without categories
  const uncategorizedSessions = [];
  for (const sessionName of allSessionNames) {
    if (!categories[sessionName]) {
      uncategorizedSessions.push(sessionName);
    }
  }

  // Output results
  if (uncategorizedSessions.length === 0) {
    console.log("All session names have categories assigned.");
  } else {
    console.log("Session names without categories:");
    console.log("=====================================");
    uncategorizedSessions.sort().forEach((sessionName) => {
      console.log(`- ${sessionName}`);
    });
    console.log(
      `\nTotal uncategorized sessions: ${uncategorizedSessions.length}`
    );
  }
}

function checkProjects() {
  // Read all clean JSON files
  const cleanDir = path.join(__dirname, "json", "clean");
  let projectData = {};
  let projectDates = {};

  try {
    const files = fs.readdirSync(cleanDir);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    // Sort files by date (extract date from filename)
    jsonFiles.sort((a, b) => {
      const dateA = a.match(/\d{8}/)?.[0] || "00000000";
      const dateB = b.match(/\d{8}/)?.[0] || "00000000";
      return dateA.localeCompare(dateB);
    });

    for (const file of jsonFiles) {
      const filePath = path.join(cleanDir, file);
      const dateMatch = file.match(/timew_clean_(\d{4})(\d{2})(\d{2})\.json/);

      if (!dateMatch) continue;

      const fileDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

      try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

        // Extract project data from each entry
        for (const entry of data) {
          if (entry.project && entry.time) {
            const projectName = entry.project;

            // Initialize project data if not exists
            if (!projectData[projectName]) {
              projectData[projectName] = {
                totalSeconds: 0,
                firstDate: fileDate,
                lastDate: fileDate,
              };
            }

            // Parse time and add to total
            const timeMatch = entry.time.match(/(\d{2}):(\d{2}):(\d{2})/);
            if (timeMatch) {
              const hours = parseInt(timeMatch[1]);
              const minutes = parseInt(timeMatch[2]);
              const seconds = parseInt(timeMatch[3]);
              const totalSeconds = hours * 3600 + minutes * 60 + seconds;
              projectData[projectName].totalSeconds += totalSeconds;
            }

            // Update date range
            if (fileDate < projectData[projectName].firstDate) {
              projectData[projectName].firstDate = fileDate;
            }
            if (fileDate > projectData[projectName].lastDate) {
              projectData[projectName].lastDate = fileDate;
            }
          }
        }
      } catch (error) {
        console.error(`Error reading ${file}:`, error.message);
      }
    }
  } catch (error) {
    console.error("Error reading clean directory:", error.message);
    return;
  }

  // Convert project data to array and sort by last active date (most recent first)
  const projectList = Object.entries(projectData).map(([name, data]) => ({
    name,
    totalTime: formatTime(data.totalSeconds),
    firstDate: data.firstDate,
    lastDate: data.lastDate,
    lastDateForSort: new Date(data.lastDate),
  }));

  // Sort by last date (most recent first)
  projectList.sort((a, b) => b.lastDateForSort - a.lastDateForSort);

  // Output results
  if (projectList.length === 0) {
    console.log("No projects found in the time tracking data.");
  } else {
    console.log("Projects sorted by last activity (most recent first):");
    console.log("====================================================");
    projectList.forEach((project) => {
      const dateRange =
        project.firstDate === project.lastDate
          ? project.lastDate
          : `${project.firstDate} to ${project.lastDate}`;

      console.log(`• ${project.name}`);
      console.log(`  Total time: ${project.totalTime}`);
      console.log(`  Active period: ${dateRange}`);
      console.log("");
    });
    console.log(`Total projects: ${projectList.length}`);
  }
}

function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function checkSessions() {
  // Read all clean JSON files
  const cleanDir = path.join(__dirname, "json", "clean");
  let sessionData = {};

  try {
    const files = fs.readdirSync(cleanDir);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    // Sort files by date (extract date from filename)
    jsonFiles.sort((a, b) => {
      const dateA = a.match(/\d{8}/)?.[0] || "00000000";
      const dateB = b.match(/\d{8}/)?.[0] || "00000000";
      return dateA.localeCompare(dateB);
    });

    for (const file of jsonFiles) {
      const filePath = path.join(cleanDir, file);
      const dateMatch = file.match(/timew_clean_(\d{4})(\d{2})(\d{2})\.json/);

      if (!dateMatch) continue;

      const fileDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

      try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

        // Extract session data from each entry
        for (const entry of data) {
          if (entry.session_name && entry.time) {
            const sessionName = entry.session_name;

            // Initialize session data if not exists
            if (!sessionData[sessionName]) {
              sessionData[sessionName] = {
                totalSeconds: 0,
                firstDate: fileDate,
                lastDate: fileDate,
              };
            }

            // Parse time and add to total
            const timeMatch = entry.time.match(/(\d{2}):(\d{2}):(\d{2})/);
            if (timeMatch) {
              const hours = parseInt(timeMatch[1]);
              const minutes = parseInt(timeMatch[2]);
              const seconds = parseInt(timeMatch[3]);
              const totalSeconds = hours * 3600 + minutes * 60 + seconds;
              sessionData[sessionName].totalSeconds += totalSeconds;
            }

            // Update date range
            if (fileDate < sessionData[sessionName].firstDate) {
              sessionData[sessionName].firstDate = fileDate;
            }
            if (fileDate > sessionData[sessionName].lastDate) {
              sessionData[sessionName].lastDate = fileDate;
            }
          }
        }
      } catch (error) {
        console.error(`Error reading ${file}:`, error.message);
      }
    }
  } catch (error) {
    console.error("Error reading clean directory:", error.message);
    return;
  }

  // Convert session data to array and sort by last active date (most recent first)
  const sessionList = Object.entries(sessionData).map(([name, data]) => ({
    name,
    totalTime: formatTime(data.totalSeconds),
    firstDate: data.firstDate,
    lastDate: data.lastDate,
    lastDateForSort: new Date(data.lastDate),
  }));

  // Sort by last date (most recent first)
  sessionList.sort((a, b) => b.lastDateForSort - a.lastDateForSort);

  // Output results
  if (sessionList.length === 0) {
    console.log("No sessions found in the time tracking data.");
  } else {
    console.log("Sessions sorted by last activity (most recent first):");
    console.log("===================================================");
    sessionList.forEach((session) => {
      const dateRange =
        session.firstDate === session.lastDate
          ? session.lastDate
          : `${session.firstDate} to ${session.lastDate}`;

      console.log(`• ${session.name}`);
      console.log(`  Total time: ${session.totalTime}`);
      console.log(`  Active period: ${dateRange}`);
      console.log("");
    });
    console.log(`Total sessions: ${sessionList.length}`);
  }
}

function checkSpecificSession(sessionName, startDate = null, endDate = null) {
  // Read all clean JSON files
  const cleanDir = path.join(__dirname, "json", "clean");
  let totalSeconds = 0;
  let totalEntries = 0;
  let earliestDate = null;
  let latestDate = null;
  const dailySummary = {};

  try {
    const files = fs.readdirSync(cleanDir);
    let jsonFiles = files.filter((file) => file.endsWith(".json"));

    // Filter files by date range if provided
    if (startDate || endDate) {
      jsonFiles = jsonFiles.filter((file) => {
        const dateMatch = file.match(/timew_clean_(\d{4})(\d{2})(\d{2})\.json/);
        if (!dateMatch) return false;

        const fileDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

        if (startDate && fileDate < startDate) return false;
        if (endDate && fileDate > endDate) return false;

        return true;
      });
    }

    jsonFiles.forEach((file) => {
      const filePath = path.join(cleanDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

      // Extract date from filename (assuming format: timew_clean_YYYYMMDD.json)
      const dateMatch = file.match(/timew_clean_(\d{8})\.json/);
      const fileDate = dateMatch ? dateMatch[1] : "unknown";

      // Filter entries for the specific session (case-insensitive)
      const sessionEntries = data.filter((entry) => {
        if (!entry.session_name) return false;
        return entry.session_name.toLowerCase() === sessionName.toLowerCase();
      });

      if (sessionEntries.length > 0) {
        let dayTotal = 0;

        sessionEntries.forEach((entry) => {
          if (entry.time) {
            // Parse time format "HH:MM:SS"
            const timeParts = entry.time.split(":");
            const hours = parseInt(timeParts[0]);
            const minutes = parseInt(timeParts[1]);
            const seconds = parseInt(timeParts[2]);
            const entrySeconds = hours * 3600 + minutes * 60 + seconds;

            totalSeconds += entrySeconds;
            dayTotal += entrySeconds;
            totalEntries++;

            // Track date range using file date
            if (dateMatch) {
              const currentDate = new Date(
                parseInt(dateMatch[1].substring(0, 4)), // year
                parseInt(dateMatch[1].substring(4, 6)) - 1, // month (0-based)
                parseInt(dateMatch[1].substring(6, 8)) // day
              );

              if (!earliestDate || currentDate < earliestDate) {
                earliestDate = currentDate;
              }
              if (!latestDate || currentDate > latestDate) {
                latestDate = currentDate;
              }
            }
          }
        });

        if (dayTotal > 0) {
          const dayHours = Math.floor(dayTotal / 3600);
          const dayMinutes = Math.floor((dayTotal % 3600) / 60);
          const daySecs = dayTotal % 60;
          dailySummary[fileDate] = {
            time: `${dayHours}h ${dayMinutes}m ${daySecs}s`,
            entries: sessionEntries.length,
          };
        }
      }
    });

    if (totalEntries === 0) {
      console.log(`No time entries found for session: "${sessionName}"`);

      // Add date range info if filtering was applied
      if (startDate || endDate) {
        const dateInfo =
          startDate && endDate
            ? startDate === endDate
              ? `on ${startDate}`
              : `from ${startDate} to ${endDate}`
            : startDate
            ? `from ${startDate}`
            : `up to ${endDate}`;
        console.log(`(searched ${dateInfo})`);
      }

      console.log("\nAvailable sessions:");

      // Show available sessions
      const allSessions = new Set();
      const allFiles = fs
        .readdirSync(cleanDir)
        .filter((file) => file.endsWith(".json"));
      allFiles.forEach((file) => {
        const filePath = path.join(cleanDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        data.forEach((entry) => {
          if (entry.session_name) {
            allSessions.add(entry.session_name);
          }
        });
      });

      Array.from(allSessions)
        .sort()
        .forEach((session) => {
          console.log(`  - "${session}"`);
        });
      return;
    }

    // Format total time
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // Format dates
    const formatDate = (date) =>
      date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

    console.log(`\nSession Summary: "${sessionName}"`);

    // Add date filter info to header if applicable
    if (startDate || endDate) {
      const dateInfo =
        startDate && endDate
          ? startDate === endDate
            ? ` (${startDate})`
            : ` (${startDate} to ${endDate})`
          : startDate
          ? ` (from ${startDate})`
          : ` (up to ${endDate})`;
      console.log(`Date Filter: ${dateInfo}`);
    }

    console.log("=".repeat(60));
    console.log(`Total Time: ${hours}h ${minutes}m ${seconds}s`);
    console.log(`Total Entries: ${totalEntries}`);
    if (earliestDate && latestDate) {
      console.log(
        `Date Range: ${formatDate(earliestDate)} - ${formatDate(latestDate)}`
      );
    }

    // Show daily breakdown
    console.log("\nDaily Breakdown:");
    console.log("-".repeat(40));
    Object.keys(dailySummary)
      .sort()
      .forEach((date) => {
        const summary = dailySummary[date];
        const formattedDate = date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
        console.log(
          `${formattedDate}: ${summary.time} (${summary.entries} entries)`
        );
      });
    console.log("=".repeat(60));
  } catch (error) {
    console.error("Error processing session data:", error.message);
  }
}

function checkSpecificProject(projectName) {
  // Read all clean JSON files
  const cleanDir = path.join(__dirname, "json", "clean");
  let totalSeconds = 0;
  let totalEntries = 0;
  let earliestDate = null;
  let latestDate = null;
  const dailySummary = {};

  try {
    const files = fs.readdirSync(cleanDir);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    jsonFiles.forEach((file) => {
      const filePath = path.join(cleanDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

      // Extract date from filename (assuming format: timew_clean_YYYYMMDD.json)
      const dateMatch = file.match(/timew_clean_(\d{8})\.json/);
      const fileDate = dateMatch ? dateMatch[1] : "unknown";

      // Filter entries for the specific project (case-insensitive)
      const projectEntries = data.filter((entry) => {
        if (!entry.project) return false;
        return entry.project.toLowerCase() === projectName.toLowerCase();
      });

      if (projectEntries.length > 0) {
        let dayTotal = 0;

        projectEntries.forEach((entry) => {
          if (entry.time) {
            // Parse time format "HH:MM:SS"
            const timeParts = entry.time.split(":");
            const hours = parseInt(timeParts[0]);
            const minutes = parseInt(timeParts[1]);
            const seconds = parseInt(timeParts[2]);
            const entrySeconds = hours * 3600 + minutes * 60 + seconds;

            totalSeconds += entrySeconds;
            dayTotal += entrySeconds;
            totalEntries++;

            // Track date range using file date
            if (dateMatch) {
              const currentDate = new Date(
                parseInt(dateMatch[1].substring(0, 4)), // year
                parseInt(dateMatch[1].substring(4, 6)) - 1, // month (0-based)
                parseInt(dateMatch[1].substring(6, 8)) // day
              );

              if (!earliestDate || currentDate < earliestDate) {
                earliestDate = currentDate;
              }
              if (!latestDate || currentDate > latestDate) {
                latestDate = currentDate;
              }
            }
          }
        });

        if (dayTotal > 0) {
          const dayHours = Math.floor(dayTotal / 3600);
          const dayMinutes = Math.floor((dayTotal % 3600) / 60);
          const daySecs = dayTotal % 60;
          dailySummary[fileDate] = {
            time: `${dayHours}h ${dayMinutes}m ${daySecs}s`,
            entries: projectEntries.length,
          };
        }
      }
    });

    if (totalEntries === 0) {
      console.log(`No time entries found for project: "${projectName}"`);
      console.log("\nAvailable projects:");

      // Show available projects
      const allProjects = new Set();
      jsonFiles.forEach((file) => {
        const filePath = path.join(cleanDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        data.forEach((entry) => {
          if (entry.project) {
            allProjects.add(entry.project);
          }
        });
      });

      Array.from(allProjects)
        .sort()
        .forEach((project) => {
          console.log(`  - "${project}"`);
        });
      return;
    }

    // Format total time
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // Format dates
    const formatDate = (date) =>
      date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

    console.log(`\nProject Summary: "${projectName}"`);
    console.log("=".repeat(60));
    console.log(`Total Time: ${hours}h ${minutes}m ${seconds}s`);
    console.log(`Total Entries: ${totalEntries}`);
    if (earliestDate && latestDate) {
      console.log(
        `Date Range: ${formatDate(earliestDate)} - ${formatDate(latestDate)}`
      );
    }

    // Show daily breakdown
    console.log("\nDaily Breakdown:");
    console.log("-".repeat(40));
    Object.keys(dailySummary)
      .sort()
      .forEach((date) => {
        const summary = dailySummary[date];
        const formattedDate = date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
        console.log(
          `${formattedDate}: ${summary.time} (${summary.entries} entries)`
        );
      });
    console.log("=".repeat(60));
  } catch (error) {
    console.error("Error processing project data:", error.message);
  }
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log(
    "Usage: node check.js [categories|projects [project-name]|sessions [session-name] [date|start-date - end-date]]"
  );
  process.exit(1);
}

if (args[0] === "categories") {
  checkCategories();
} else if (args[0] === "projects") {
  if (args.length === 1) {
    // No project name specified, show all projects
    checkProjects();
  } else {
    // Project name specified, show details for that project
    const projectName = args.slice(1).join(" ");
    checkSpecificProject(projectName);
  }
} else if (args[0] === "sessions") {
  if (args.length === 1) {
    // No session name specified, show all sessions
    checkSessions();
  } else {
    // Session name specified, check for date filters
    let sessionName = args[1];
    let startDate = null;
    let endDate = null;

    if (args.length === 3) {
      // Single date: node check.js sessions "session-name" 2025-11-05
      const singleDate = args[2];
      if (/^\d{4}-\d{2}-\d{2}$/.test(singleDate)) {
        startDate = singleDate;
        endDate = singleDate;
      } else {
        console.error("Invalid date format. Use YYYY-MM-DD");
        process.exit(1);
      }
    } else if (args.length === 5 && args[2] === "-") {
      // Date range: node check.js sessions "session-name" 2025-11-01 - 2025-11-10
      const start = args[1];
      const end = args[4];

      if (
        /^\d{4}-\d{2}-\d{2}$/.test(start) &&
        /^\d{4}-\d{2}-\d{2}$/.test(end)
      ) {
        // If we have date range, extract session name differently
        console.error(
          'Invalid usage for date range. Use: node check.js sessions "session-name" start-date - end-date'
        );
        process.exit(1);
      }

      // Actually handle this case correctly - session name then date range
      sessionName = args[1];
      startDate = args[2];
      endDate = args[4];

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ) {
        console.error("Invalid date format. Use YYYY-MM-DD");
        process.exit(1);
      }
    } else if (args.length > 2) {
      // Handle case where session name might have spaces
      // Look for date patterns in the arguments
      let dateStartIndex = -1;

      for (let i = 2; i < args.length; i++) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(args[i])) {
          dateStartIndex = i;
          break;
        }
      }

      if (dateStartIndex !== -1) {
        // Found date, session name is everything before the date
        sessionName = args.slice(1, dateStartIndex).join(" ");

        if (
          dateStartIndex + 2 < args.length &&
          args[dateStartIndex + 1] === "-"
        ) {
          // Date range format
          startDate = args[dateStartIndex];
          endDate = args[dateStartIndex + 2];

          if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
            console.error("Invalid end date format. Use YYYY-MM-DD");
            process.exit(1);
          }
        } else if (dateStartIndex === args.length - 1) {
          // Single date format
          startDate = args[dateStartIndex];
          endDate = args[dateStartIndex];
        } else {
          console.error(
            'Invalid date format. Use: "session-name" YYYY-MM-DD or "session-name" YYYY-MM-DD - YYYY-MM-DD'
          );
          process.exit(1);
        }
      } else {
        // No date found, entire remainder is session name
        sessionName = args.slice(1).join(" ");
      }
    }

    checkSpecificSession(sessionName, startDate, endDate);
  }
} else {
  console.log(
    "Usage: node check.js [categories|projects [project-name]|sessions [session-name] [date|start-date - end-date]]"
  );
  process.exit(1);
}
