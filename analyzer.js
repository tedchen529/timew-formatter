const fs = require('fs')
const path = require('path')

/**
 * Parse time string in format HH:MM:SS to seconds
 */
function parseTimeToSeconds(timeStr) {
  const [hours, minutes, seconds] = timeStr.split(':').map(Number)
  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Convert seconds back to HH:MM:SS format
 */
function secondsToTimeFormat(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Parse date string in format YYYY-MM-DD
 */
function parseDate(dateStr) {
  return new Date(dateStr)
}

/**
 * Generate array of dates between start and end date (inclusive)
 */
function getDatesBetween(startDate, endDate) {
  const dates = []
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    dates.push(new Date(currentDate))
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return dates
}

/**
 * Format date to YYYY-MM-DD string
 */
function formatDate(date) {
  return date.toISOString().split('T')[0]
}

/**
 * Load and parse JSON file for a specific date
 */
function loadTimeDataForDate(date) {
  const dateStr = formatDate(date).replace(/-/g, '')
  const filePath = path.join(
    __dirname,
    'json',
    'clean',
    `timew_clean_${dateStr}.json`
  )

  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: File not found for date ${dateStr}: ${filePath}`)
    return []
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return data
  } catch (error) {
    console.error(`Error reading file for date ${dateStr}:`, error.message)
    return []
  }
}

/**
 * Aggregate time data for sessions
 */
function aggregateSessionTime(timeEntries) {
  const sessionTotals = {}

  timeEntries.forEach((entry) => {
    const sessionName = entry.session_name
    const timeInSeconds = parseTimeToSeconds(entry.time)

    if (!sessionTotals[sessionName]) {
      sessionTotals[sessionName] = 0
    }

    sessionTotals[sessionName] += timeInSeconds
  })

  // Convert back to time format and sort alphabetically
  const sortedSessions = Object.keys(sessionTotals)
    .sort()
    .map((sessionName) => ({
      session: sessionName,
      totalTime: secondsToTimeFormat(sessionTotals[sessionName]),
    }))

  return sortedSessions
}

/**
 * Aggregate time data for projects
 */
function aggregateProjectTime(timeEntries) {
  const projectTotals = {}

  timeEntries.forEach((entry) => {
    if (entry.project) {
      const projectName = entry.project
      const timeInSeconds = parseTimeToSeconds(entry.time)

      if (!projectTotals[projectName]) {
        projectTotals[projectName] = 0
      }

      projectTotals[projectName] += timeInSeconds
    }
  })

  // Convert back to time format and sort alphabetically
  const sortedProjects = Object.keys(projectTotals)
    .sort()
    .map((projectName) => ({
      project: projectName,
      totalTime: secondsToTimeFormat(projectTotals[projectName]),
    }))

  return sortedProjects
}

/**
 * Export analysis results to JSON file
 */
function exportResults(analysisResults, startDateStr, endDateStr = null) {
  // Create results directory if it doesn't exist
  const resultsDir = path.join(__dirname, 'json', 'results')
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true })
  }

  // Generate filename based on date range
  let filename
  if (endDateStr === null) {
    const dateFormatted = startDateStr.replace(/-/g, '')
    filename = `timew_results_${dateFormatted}-${dateFormatted}.json`
  } else {
    const startFormatted = startDateStr.replace(/-/g, '')
    const endFormatted = endDateStr.replace(/-/g, '')
    filename = `timew_results_${startFormatted}-${endFormatted}.json`
  }

  const filePath = path.join(resultsDir, filename)

  try {
    fs.writeFileSync(filePath, JSON.stringify(analysisResults, null, 2), 'utf8')
    console.log(`\nResults exported to: ${filePath}`)
  } catch (error) {
    console.error('Error exporting results:', error.message)
  }
}

/**
 * Main analysis function
 */
function analyzeTimeData(
  startDateStr,
  endDateStr = null,
  shouldExport = false
) {
  let dates = []
  let isDateRange = false

  if (endDateStr === null) {
    // Single date analysis
    dates = [parseDate(startDateStr)]
    console.log(`Analyzing time data for ${startDateStr}`)
  } else {
    // Date range analysis
    const startDate = parseDate(startDateStr)
    const endDate = parseDate(endDateStr)
    dates = getDatesBetween(startDate, endDate)
    isDateRange = true
    console.log(`Analyzing time data from ${startDateStr} to ${endDateStr}`)
  }

  // Collect all time entries from all dates
  let allTimeEntries = []
  let filesFound = 0

  dates.forEach((date) => {
    const dateEntries = loadTimeDataForDate(date)
    if (dateEntries.length > 0) {
      allTimeEntries = allTimeEntries.concat(dateEntries)
      filesFound++
    }
  })

  if (allTimeEntries.length === 0) {
    console.log('No time data found for the specified date(s).')
    return
  }

  console.log(
    `\nFound data from ${filesFound} file(s) with ${allTimeEntries.length} total entries.\n`
  )

  // Aggregate and display results
  const sessionAggregates = aggregateSessionTime(allTimeEntries)
  const projectAggregates = aggregateProjectTime(allTimeEntries)

  // Calculate grand total first
  const grandTotalSeconds = sessionAggregates.reduce((total, { totalTime }) => {
    return total + parseTimeToSeconds(totalTime)
  }, 0)

  console.log('Session Time Aggregates (ordered alphabetically):')
  console.log('================================================')

  sessionAggregates.forEach(({ session, totalTime }) => {
    const sessionSeconds = parseTimeToSeconds(totalTime)
    const percentage = ((sessionSeconds / grandTotalSeconds) * 100).toFixed(1)

    let displayTime = totalTime
    if (isDateRange && dates.length > 1) {
      const averageSeconds = Math.round(sessionSeconds / dates.length)
      const averageTime = secondsToTimeFormat(averageSeconds)
      displayTime = `${totalTime}/${averageTime}`
    }

    console.log(`${session}: ${displayTime} (${percentage}%)`)
  })

  console.log('================================================')
  console.log(
    `Total time across all sessions: ${secondsToTimeFormat(grandTotalSeconds)}`
  )

  // Display Projects section if there are any projects
  if (projectAggregates.length > 0) {
    console.log('\nProjects (ordered alphabetically):')
    console.log('==================================')

    projectAggregates.forEach(({ project, totalTime }) => {
      const projectSeconds = parseTimeToSeconds(totalTime)
      const percentage = ((projectSeconds / grandTotalSeconds) * 100).toFixed(1)

      let displayTime = totalTime
      if (isDateRange && dates.length > 1) {
        const averageSeconds = Math.round(projectSeconds / dates.length)
        const averageTime = secondsToTimeFormat(averageSeconds)
        displayTime = `${totalTime}/${averageTime}`
      }

      console.log(`${project}: ${displayTime} (${percentage}%)`)
    })

    console.log('==================================')

    // Calculate total project time
    const totalProjectSeconds = projectAggregates.reduce(
      (total, { totalTime }) => {
        return total + parseTimeToSeconds(totalTime)
      },
      0
    )

    console.log(
      `Total time across all projects: ${secondsToTimeFormat(
        totalProjectSeconds
      )}`
    )
  }

  // Export results if requested
  if (shouldExport) {
    const totalProjectSeconds = projectAggregates.reduce(
      (total, { totalTime }) => {
        return total + parseTimeToSeconds(totalTime)
      },
      0
    )

    const analysisResults = {
      dateRange: {
        startDate: startDateStr,
        endDate: endDateStr,
      },
      summary: {
        totalFiles: filesFound,
        totalEntries: allTimeEntries.length,
        totalTime: secondsToTimeFormat(grandTotalSeconds),
        totalTimeSeconds: grandTotalSeconds,
        totalProjectTime: secondsToTimeFormat(totalProjectSeconds),
        totalProjectTimeSeconds: totalProjectSeconds,
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
        const sessionSeconds = parseTimeToSeconds(totalTime)
        const percentage = ((sessionSeconds / grandTotalSeconds) * 100).toFixed(
          1
        )
        const sessionData = {
          sessionName: session,
          totalTime: totalTime,
          totalTimeSeconds: sessionSeconds,
          percentage: `${percentage}%`,
        }

        // Add average time if it's a date range
        if (isDateRange && dates.length > 1) {
          const averageSeconds = Math.round(sessionSeconds / dates.length)
          sessionData.averageTime = secondsToTimeFormat(averageSeconds)
          sessionData.averageTimeSeconds = averageSeconds
        }

        return sessionData
      }),
      projects: projectAggregates.map(({ project, totalTime }) => {
        const projectSeconds = parseTimeToSeconds(totalTime)
        const percentage = ((projectSeconds / grandTotalSeconds) * 100).toFixed(
          1
        )
        const projectData = {
          projectName: project,
          totalTime: totalTime,
          totalTimeSeconds: projectSeconds,
          percentage: `${percentage}%`,
        }

        // Add average time if it's a date range
        if (isDateRange && dates.length > 1) {
          const averageSeconds = Math.round(projectSeconds / dates.length)
          projectData.averageTime = secondsToTimeFormat(averageSeconds)
          projectData.averageTimeSeconds = averageSeconds
        }

        return projectData
      }),
      generatedAt: new Date().toISOString(),
    }

    exportResults(analysisResults, startDateStr, endDateStr)
  }
}

/**
 * Parse command line arguments and run analysis
 */
function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log('Usage:')
    console.log('  Single date: node analyzer.js YYYY-MM-DD [export]')
    console.log(
      '  Date range:  node analyzer.js YYYY-MM-DD - YYYY-MM-DD [export]'
    )
    console.log('')
    console.log('Examples:')
    console.log('  node analyzer.js 2025-10-30')
    console.log('  node analyzer.js 2025-10-30 export')
    console.log('  node analyzer.js 2025-09-30 - 2025-10-30')
    console.log('  node analyzer.js 2025-09-30 - 2025-10-30 export')
    return
  }

  // Check if export is requested
  const shouldExport = args.includes('export')
  const filteredArgs = args.filter((arg) => arg !== 'export')

  if (filteredArgs.length === 1) {
    // Single date analysis
    analyzeTimeData(filteredArgs[0], null, shouldExport)
  } else if (filteredArgs.length === 3 && filteredArgs[1] === '-') {
    // Date range analysis
    analyzeTimeData(filteredArgs[0], filteredArgs[2], shouldExport)
  } else {
    console.error('Invalid arguments. Use:')
    console.error('  Single date: node analyzer.js YYYY-MM-DD [export]')
    console.error(
      '  Date range:  node analyzer.js YYYY-MM-DD - YYYY-MM-DD [export]'
    )
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main()
}

module.exports = {
  aggregateSessionTime,
  aggregateProjectTime,
  parseTimeToSeconds,
  secondsToTimeFormat,
  analyzeTimeData,
  exportResults,
}
