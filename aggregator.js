const fs = require("fs");

function timeToMinutes(timeStr) {
  const [hours, minutes, seconds] = timeStr.split(":").map(Number);
  return hours * 60 + minutes + (seconds || 0) / 60;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  const seconds = Math.round((totalMinutes % 1) * 60);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function aggregateTimeBySession(data) {
  const sessionTotals = {};

  // Aggregate time for each session_name
  data.forEach((entry) => {
    const sessionName = entry.session_name;
    const timeInMinutes = timeToMinutes(entry.time);

    if (sessionTotals[sessionName]) {
      sessionTotals[sessionName] += timeInMinutes;
    } else {
      sessionTotals[sessionName] = timeInMinutes;
    }
  });

  // Convert back to time format and sort alphabetically
  const sortedResults = Object.keys(sessionTotals)
    .sort()
    .map((sessionName) => ({
      session_name: sessionName,
      total_time: minutesToTime(sessionTotals[sessionName]),
    }));

  return sortedResults;
}

function main() {
  try {
    // Read the test data file
    const data = JSON.parse(
      fs.readFileSync("aggregator_test_data.json", "utf8")
    );

    // Aggregate the data
    const aggregatedResults = aggregateTimeBySession(data);

    // Calculate total time across all sessions
    const totalMinutes = aggregatedResults.reduce((sum, result) => {
      return sum + timeToMinutes(result.total_time);
    }, 0);
    const totalTimeFormatted = minutesToTime(totalMinutes);

    // Display results
    console.log("Time spent by session (alphabetical order):");
    console.log("==========================================");
    aggregatedResults.forEach((result) => {
      console.log(`${result.session_name}: ${result.total_time}`);
    });
    console.log("-----");
    console.log(`total: ${totalTimeFormatted}`);

    // Also write to output file
    fs.writeFileSync(
      "aggregated_results.json",
      JSON.stringify(aggregatedResults, null, 2)
    );
    console.log("\nResults also saved to aggregated_results.json");
  } catch (error) {
    console.error("Error:", error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { aggregateTimeBySession, timeToMinutes, minutesToTime };
