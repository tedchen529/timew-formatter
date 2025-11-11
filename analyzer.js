const fs = require("fs");
const path = require("path");

/**
 * Load categories configuration
 */
function loadCategories() {
  const categoriesPath = path.join(
    __dirname,
    "json",
    "settings",
    "categories.json"
  );

  if (!fs.existsSync(categoriesPath)) {
    console.warn("Warning: Categories file not found:", categoriesPath);
    return {};
  }

  try {
    const data = JSON.parse(fs.readFileSync(categoriesPath, "utf8"));
    return data[0]; // Categories are in the first object of the array
  } catch (error) {
    console.error("Error reading categories file:", error.message);
    return {};
  }
}

/**
 * Map session name to main category
 */
function getMainCategory(sessionName, categories) {
  for (const [categoryName, sessionList] of Object.entries(categories)) {
    if (sessionList.includes(sessionName)) {
      return categoryName;
    }
  }
  return "uncategorized"; // For sessions not found in any category
}

/**
 * Parse time string in format HH:MM:SS to seconds
 */
function parseTimeToSeconds(timeStr) {
  const [hours, minutes, seconds] = timeStr.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Convert seconds back to HH:MM:SS format
 */
function secondsToTimeFormat(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Parse date string in format YYYY-MM-DD
 */
function parseDate(dateStr) {
  return new Date(dateStr);
}

/**
 * Generate array of dates between start and end date (inclusive)
 */
function getDatesBetween(startDate, endDate) {
  const dates = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

/**
 * Format date to YYYY-MM-DD string
 */
function formatDate(date) {
  return date.toISOString().split("T")[0];
}

/**
 * Load and parse JSON file for a specific date
 */
function loadTimeDataForDate(date) {
  const dateStr = formatDate(date).replace(/-/g, "");
  const filePath = path.join(
    __dirname,
    "json",
    "clean",
    `timew_clean_${dateStr}.json`
  );

  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: File not found for date ${dateStr}: ${filePath}`);
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return data;
  } catch (error) {
    console.error(`Error reading file for date ${dateStr}:`, error.message);
    return [];
  }
}

/**
 * Extract day type from a clean JSON file
 */
function getDayTypeForDate(date) {
  const dateStr = formatDate(date).replace(/-/g, "");
  const filePath = path.join(
    __dirname,
    "json",
    "clean",
    `timew_clean_${dateStr}.json`
  );

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    // The day type should be in the last element of the array
    const lastElement = data[data.length - 1];
    if (lastElement && lastElement.dayType) {
      return lastElement.dayType;
    }
    return null;
  } catch (error) {
    console.error(`Error reading day type for date ${dateStr}:`, error.message);
    return null;
  }
}

/**
 * Aggregate time data for sessions
 */
function aggregateSessionTime(timeEntries) {
  const sessionTotals = {};

  timeEntries.forEach((entry) => {
    const sessionName = entry.session_name;
    const timeInSeconds = parseTimeToSeconds(entry.time);

    if (!sessionTotals[sessionName]) {
      sessionTotals[sessionName] = 0;
    }

    sessionTotals[sessionName] += timeInSeconds;
  });

  // Convert back to time format and sort alphabetically
  const sortedSessions = Object.keys(sessionTotals)
    .sort()
    .map((sessionName) => ({
      session: sessionName,
      totalTime: secondsToTimeFormat(sessionTotals[sessionName]),
    }));

  return sortedSessions;
}

/**
 * Aggregate time data for projects
 */
function aggregateProjectTime(timeEntries) {
  const projectTotals = {};

  timeEntries.forEach((entry) => {
    if (entry.project) {
      const projectName = entry.project;
      const timeInSeconds = parseTimeToSeconds(entry.time);

      if (!projectTotals[projectName]) {
        projectTotals[projectName] = 0;
      }

      projectTotals[projectName] += timeInSeconds;
    }
  });

  // Convert back to time format and sort alphabetically
  const sortedProjects = Object.keys(projectTotals)
    .sort()
    .map((projectName) => ({
      project: projectName,
      totalTime: secondsToTimeFormat(projectTotals[projectName]),
    }));

  return sortedProjects;
}

/**
 * Aggregate time data by main categories (excluding uncategorized)
 */
function aggregateCategoryTime(timeEntries, categories) {
  const categoryTotals = {};

  timeEntries.forEach((entry) => {
    const sessionName = entry.session_name;
    const category = getMainCategory(sessionName, categories);
    const timeInSeconds = parseTimeToSeconds(entry.time);

    // Only include categorized entries (exclude 'uncategorized')
    if (category !== "uncategorized") {
      if (!categoryTotals[category]) {
        categoryTotals[category] = 0;
      }

      categoryTotals[category] += timeInSeconds;
    }
  });

  // Convert back to time format and sort alphabetically
  const sortedCategories = Object.keys(categoryTotals)
    .sort()
    .map((categoryName) => ({
      category: categoryName,
      totalTime: secondsToTimeFormat(categoryTotals[categoryName]),
    }));

  return sortedCategories;
}

/**
 * Export analysis results to JSON file
 */
function exportResults(
  analysisResults,
  startDateStr,
  endDateStr = null,
  dayTypeFilters = [],
  isExceptFilter = false
) {
  // Create results directory if it doesn't exist
  const resultsDir = path.join(__dirname, "json", "results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Generate filename based on date range
  let filename;
  if (endDateStr === null) {
    const dateFormatted = startDateStr.replace(/-/g, "");
    filename = `timew_results_${dateFormatted}-${dateFormatted}.json`;
  } else {
    const startFormatted = startDateStr.replace(/-/g, "");
    const endFormatted = endDateStr.replace(/-/g, "");
    filename = `timew_results_${startFormatted}-${endFormatted}.json`;
  }

  // Add day type filter to filename if specified
  if (dayTypeFilters.length > 0) {
    const dayTypeString = dayTypeFilters.join("_");
    const filterType = isExceptFilter ? "except" : "just";
    filename = filename.replace(
      ".json",
      `_${filterType}_${dayTypeString}.json`
    );
  }

  const filePath = path.join(resultsDir, filename);

  try {
    fs.writeFileSync(
      filePath,
      JSON.stringify(analysisResults, null, 2),
      "utf8"
    );
    console.log(`\nResults exported to: ${filePath}`);
  } catch (error) {
    console.error("Error exporting results:", error.message);
  }
}

/**
 * Main analysis function
 */
function analyzeTimeData(
  startDateStr,
  endDateStr = null,
  shouldExport = false,
  dayTypeFilters = [],
  isExceptFilter = false
) {
  let dates = [];
  let isDateRange = false;

  if (endDateStr === null) {
    // Single date analysis
    dates = [parseDate(startDateStr)];
    console.log(`Analyzing time data for ${startDateStr}`);
  } else {
    // Date range analysis
    const startDate = parseDate(startDateStr);
    const endDate = parseDate(endDateStr);
    dates = getDatesBetween(startDate, endDate);
    isDateRange = true;
    console.log(`Analyzing time data from ${startDateStr} to ${endDateStr}`);
  }

  // If day type filters are specified, filter dates by day type
  if (dayTypeFilters.length > 0) {
    const filteredDates = [];
    const matchingDayTypes = [];

    dates.forEach((date) => {
      const dayType = getDayTypeForDate(date);
      let shouldInclude = false;

      if (isExceptFilter) {
        // For "except" filter, include dates that DON'T match the specified day types
        shouldInclude = dayType && !dayTypeFilters.includes(dayType);
      } else {
        // For "just" filter, include dates that DO match the specified day types
        shouldInclude = dayType && dayTypeFilters.includes(dayType);
      }

      if (shouldInclude) {
        filteredDates.push(date);
        matchingDayTypes.push({
          date: formatDate(date),
          dayType: dayType,
        });
      }
    });

    if (filteredDates.length === 0) {
      const filterType = isExceptFilter ? "except" : "just";
      console.log(
        `No results found for day type filter "${filterType}": ${dayTypeFilters.join(
          ", "
        )}`
      );
      return;
    }

    dates = filteredDates;
    const filterType = isExceptFilter ? "excluding" : "matching";
    console.log(
      `Filtered to ${
        filteredDates.length
      } day(s) ${filterType} day type(s): ${dayTypeFilters.join(", ")}`
    );
    matchingDayTypes.forEach(({ date, dayType }) => {
      console.log(`  - ${date}: ${dayType}`);
    });
    console.log("");
  }

  // Collect all time entries from all dates
  let allTimeEntries = [];
  let filesFound = 0;

  dates.forEach((date) => {
    const dateEntries = loadTimeDataForDate(date);
    if (dateEntries.length > 0) {
      // Filter out the day type entry (it doesn't have session_name or time fields)
      const timeEntries = dateEntries.filter(
        (entry) => entry.session_name && entry.time
      );
      allTimeEntries = allTimeEntries.concat(timeEntries);
      filesFound++;
    }
  });

  if (allTimeEntries.length === 0) {
    console.log("No time data found for the specified date(s).");
    return;
  }

  console.log(
    `\nFound data from ${filesFound} file(s) with ${allTimeEntries.length} total entries.\n`
  );

  // Load categories for main category analysis
  const categories = loadCategories();

  // Aggregate and display results
  const sessionAggregates = aggregateSessionTime(allTimeEntries);
  const projectAggregates = aggregateProjectTime(allTimeEntries);
  const categoryAggregates = aggregateCategoryTime(allTimeEntries, categories);

  // Calculate grand total first
  const grandTotalSeconds = sessionAggregates.reduce((total, { totalTime }) => {
    return total + parseTimeToSeconds(totalTime);
  }, 0);

  console.log("Session Time Aggregates (ordered alphabetically):");
  console.log("================================================");

  sessionAggregates.forEach(({ session, totalTime }) => {
    const sessionSeconds = parseTimeToSeconds(totalTime);
    const percentage = ((sessionSeconds / grandTotalSeconds) * 100).toFixed(1);

    let displayTime = totalTime;
    if (isDateRange && dates.length > 1) {
      const averageSeconds = Math.round(sessionSeconds / dates.length);
      const averageTime = secondsToTimeFormat(averageSeconds);
      displayTime = `${totalTime}/${averageTime}`;
    }

    console.log(`${session}: ${displayTime} (${percentage}%)`);
  });

  console.log("================================================");
  console.log(
    `Total time across all sessions: ${secondsToTimeFormat(grandTotalSeconds)}`
  );

  // Display Projects section if there are any projects
  if (projectAggregates.length > 0) {
    console.log("\nProjects (ordered alphabetically):");
    console.log("==================================");

    projectAggregates.forEach(({ project, totalTime }) => {
      const projectSeconds = parseTimeToSeconds(totalTime);
      const percentage = ((projectSeconds / grandTotalSeconds) * 100).toFixed(
        1
      );

      let displayTime = totalTime;
      if (isDateRange && dates.length > 1) {
        const averageSeconds = Math.round(projectSeconds / dates.length);
        const averageTime = secondsToTimeFormat(averageSeconds);
        displayTime = `${totalTime}/${averageTime}`;
      }

      console.log(`${project}: ${displayTime} (${percentage}%)`);
    });

    console.log("==================================");

    // Calculate total project time
    const totalProjectSeconds = projectAggregates.reduce(
      (total, { totalTime }) => {
        return total + parseTimeToSeconds(totalTime);
      },
      0
    );

    console.log(
      `Total time across all projects: ${secondsToTimeFormat(
        totalProjectSeconds
      )}`
    );
  }

  // Display By Main Categories section
  if (categoryAggregates.length > 0) {
    console.log("\nBy Main Categories (ordered alphabetically):");
    console.log("===========================================");

    // Calculate total categorized time for percentage calculations
    const totalCategorizedSeconds = categoryAggregates.reduce(
      (total, { totalTime }) => {
        return total + parseTimeToSeconds(totalTime);
      },
      0
    );

    categoryAggregates.forEach(({ category, totalTime }) => {
      const categorySeconds = parseTimeToSeconds(totalTime);
      const percentage = (
        (categorySeconds / totalCategorizedSeconds) *
        100
      ).toFixed(1);

      let displayTime = totalTime;
      if (isDateRange && dates.length > 1) {
        const averageSeconds = Math.round(categorySeconds / dates.length);
        const averageTime = secondsToTimeFormat(averageSeconds);
        displayTime = `${totalTime}/${averageTime}`;
      }

      console.log(`${category}: ${displayTime} (${percentage}%)`);
    });

    console.log("===========================================");

    console.log(
      `Total time across all categories: ${secondsToTimeFormat(
        totalCategorizedSeconds
      )}`
    );
  }

  // Export results if requested
  if (shouldExport) {
    const totalProjectSeconds = projectAggregates.reduce(
      (total, { totalTime }) => {
        return total + parseTimeToSeconds(totalTime);
      },
      0
    );

    const totalCategorySeconds = categoryAggregates.reduce(
      (total, { totalTime }) => {
        return total + parseTimeToSeconds(totalTime);
      },
      0
    );

    const analysisResults = {
      dateRange: {
        startDate: startDateStr,
        endDate: endDateStr,
        ...(dayTypeFilters.length > 0 && {
          dayTypeFilter: dayTypeFilters,
          filterType: isExceptFilter ? "except" : "just",
          filteredDescription: isExceptFilter
            ? `Filtered to exclude: ${dayTypeFilters.join(", ")}`
            : `Filtered to show only: ${dayTypeFilters.join(", ")}`,
        }),
      },
      summary: {
        totalFiles: filesFound,
        totalEntries: allTimeEntries.length,
        totalTime: secondsToTimeFormat(grandTotalSeconds),
        totalTimeSeconds: grandTotalSeconds,
        totalProjectTime: secondsToTimeFormat(totalProjectSeconds),
        totalProjectTimeSeconds: totalProjectSeconds,
        totalCategoryTime: secondsToTimeFormat(totalCategorySeconds),
        totalCategoryTimeSeconds: totalCategorySeconds,
        ...(isDateRange &&
          dates.length > 1 && {
            totalDays: dates.length,
            averageTimePerDay: secondsToTimeFormat(
              Math.round(grandTotalSeconds / dates.length)
            ),
            averageTimePerDaySeconds: Math.round(
              grandTotalSeconds / dates.length
            ),
          }),
      },
      sessions: sessionAggregates.map(({ session, totalTime }) => {
        const sessionSeconds = parseTimeToSeconds(totalTime);
        const percentage = ((sessionSeconds / grandTotalSeconds) * 100).toFixed(
          1
        );
        const sessionData = {
          sessionName: session,
          totalTime: totalTime,
          totalTimeSeconds: sessionSeconds,
          percentage: `${percentage}%`,
        };

        // Add average time if it's a date range
        if (isDateRange && dates.length > 1) {
          const averageSeconds = Math.round(sessionSeconds / dates.length);
          sessionData.averageTime = secondsToTimeFormat(averageSeconds);
          sessionData.averageTimeSeconds = averageSeconds;
        }

        return sessionData;
      }),
      projects: projectAggregates.map(({ project, totalTime }) => {
        const projectSeconds = parseTimeToSeconds(totalTime);
        const percentage = ((projectSeconds / grandTotalSeconds) * 100).toFixed(
          1
        );
        const projectData = {
          projectName: project,
          totalTime: totalTime,
          totalTimeSeconds: projectSeconds,
          percentage: `${percentage}%`,
        };

        // Add average time if it's a date range
        if (isDateRange && dates.length > 1) {
          const averageSeconds = Math.round(projectSeconds / dates.length);
          projectData.averageTime = secondsToTimeFormat(averageSeconds);
          projectData.averageTimeSeconds = averageSeconds;
        }

        return projectData;
      }),
      categories: categoryAggregates.map(({ category, totalTime }) => {
        const categorySeconds = parseTimeToSeconds(totalTime);
        const percentage = (
          (categorySeconds / totalCategorySeconds) *
          100
        ).toFixed(1);
        const categoryData = {
          categoryName: category,
          totalTime: totalTime,
          totalTimeSeconds: categorySeconds,
          percentage: `${percentage}%`,
        };

        // Add average time if it's a date range
        if (isDateRange && dates.length > 1) {
          const averageSeconds = Math.round(categorySeconds / dates.length);
          categoryData.averageTime = secondsToTimeFormat(averageSeconds);
          categoryData.averageTimeSeconds = averageSeconds;
        }

        return categoryData;
      }),
      generatedAt: new Date().toISOString(),
    };

    exportResults(
      analysisResults,
      startDateStr,
      endDateStr,
      dayTypeFilters,
      isExceptFilter
    );
  }
}

/**
 * Parse command line arguments and run analysis
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage:");
    console.log("  Single date: node analyzer.js YYYY-MM-DD [export]");
    console.log(
      "  Date range:  node analyzer.js YYYY-MM-DD - YYYY-MM-DD [export]"
    );
    console.log(
      "  Day type filter: node analyzer.js YYYY-MM-DD - YYYY-MM-DD [export] just <dayType1> [dayType2] ..."
    );
    console.log(
      "  Day type exclusion: node analyzer.js YYYY-MM-DD - YYYY-MM-DD [export] except <dayType1> [dayType2] ..."
    );
    console.log("");
    console.log("Examples:");
    console.log("  node analyzer.js 2025-10-30");
    console.log("  node analyzer.js 2025-10-30 export");
    console.log("  node analyzer.js 2025-09-30 - 2025-10-30");
    console.log("  node analyzer.js 2025-09-30 - 2025-10-30 export");
    console.log("  node analyzer.js 2025-10-27 - 2025-10-29 just workday");
    console.log("  node analyzer.js 2025-10-27 - 2025-10-29 except weekend");
    console.log(
      "  node analyzer.js 2025-10-27 - 2025-10-29 export just workday workday-outlier"
    );
    console.log(
      "  node analyzer.js 2025-10-27 - 2025-10-29 export except weekend holiday"
    );
    return;
  }

  // Check if export is requested
  const shouldExport = args.includes("export");

  // Check if day type filtering is requested
  const justIndex = args.indexOf("just");
  const exceptIndex = args.indexOf("except");
  let dayTypeFilters = [];
  let isExceptFilter = false;

  if (justIndex !== -1 && exceptIndex !== -1) {
    console.error(
      'Cannot use both "just" and "except" filters in the same command.'
    );
    return;
  }

  if (justIndex !== -1) {
    // Extract day types after "just"
    dayTypeFilters = args
      .slice(justIndex + 1)
      .filter((arg) => arg !== "export" && arg !== "except");
    isExceptFilter = false;
  } else if (exceptIndex !== -1) {
    // Extract day types after "except"
    dayTypeFilters = args
      .slice(exceptIndex + 1)
      .filter((arg) => arg !== "export" && arg !== "just");
    isExceptFilter = true;
  }

  // Filter out 'export', 'just', 'except' and day types from args
  const filteredArgs = args.filter((arg, index) => {
    return (
      arg !== "export" &&
      arg !== "just" &&
      arg !== "except" &&
      (justIndex === -1 || index < justIndex || index === justIndex) &&
      (exceptIndex === -1 || index < exceptIndex || index === exceptIndex)
    );
  });

  // Check for single date with day type filter (not allowed)
  if (filteredArgs.length === 1 && dayTypeFilters.length > 0) {
    console.error(
      "Day type filtering is not available for single dates. Only intervals are supported."
    );
    return;
  }

  if (filteredArgs.length === 1) {
    // Single date analysis
    analyzeTimeData(filteredArgs[0], null, shouldExport, [], false);
  } else if (filteredArgs.length === 3 && filteredArgs[1] === "-") {
    // Date range analysis
    analyzeTimeData(
      filteredArgs[0],
      filteredArgs[2],
      shouldExport,
      dayTypeFilters,
      isExceptFilter
    );
  } else {
    console.error("Invalid arguments. Use:");
    console.error("  Single date: node analyzer.js YYYY-MM-DD [export]");
    console.error(
      "  Date range:  node analyzer.js YYYY-MM-DD - YYYY-MM-DD [export] [just|except <dayType1> [dayType2] ...]"
    );
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  aggregateSessionTime,
  aggregateProjectTime,
  aggregateCategoryTime,
  parseTimeToSeconds,
  secondsToTimeFormat,
  analyzeTimeData,
  exportResults,
  loadCategories,
  getMainCategory,
  getDayTypeForDate,
};
