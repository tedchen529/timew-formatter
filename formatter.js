const fs = require("fs");
const path = require("path");

const filename = process.argv[2];

if (!filename) {
  console.log("Please provide a filename as an argument.");
  process.exit(1);
}

function parseTimeString(timeStr) {
  // Convert from "20251027T012300Z" format to Date object
  const year = parseInt(timeStr.substring(0, 4));
  const month = parseInt(timeStr.substring(4, 6)) - 1; // Month is 0-indexed
  const day = parseInt(timeStr.substring(6, 8));
  const hour = parseInt(timeStr.substring(9, 11));
  const minute = parseInt(timeStr.substring(11, 13));
  const second = parseInt(timeStr.substring(13, 15));

  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

function formatTime(date) {
  // Convert to Taiwan timezone (UTC+8) and format as "hh:mm:ss"
  const taiwanDate = new Date(date.getTime() + 8 * 60 * 60 * 1000); // Add 8 hours for UTC+8
  const hours = taiwanDate.getUTCHours().toString().padStart(2, "0");
  const minutes = taiwanDate.getUTCMinutes().toString().padStart(2, "0");
  const seconds = taiwanDate.getUTCSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function calculateDuration(startDate, endDate) {
  const diffMs = endDate - startDate;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

try {
  // Look for file in json/raw folder
  const filePath = path.join(__dirname, "json", "raw", filename);
  const fileContent = fs.readFileSync(filePath, "utf8");
  const jsonData = JSON.parse(fileContent);

  const reformattedData = jsonData
    .filter((entry) => entry.end) // Only process entries that have an end time
    .map((entry) => {
      const startDate = parseTimeString(entry.start);
      const endDate = parseTimeString(entry.end);

      const reformatted = {
        start: formatTime(startDate),
        end: formatTime(endDate),
        session_name: entry.tags && entry.tags.length > 0 ? entry.tags[0] : "",
        time: calculateDuration(startDate, endDate),
      };

      // Add note if annotation exists
      if (entry.annotation) {
        reformatted.note = entry.annotation;
      }

      return reformatted;
    });

  // Extract date from filename to create output filename
  // Assuming input filename format is like "timew_20251030.json"
  const dateMatch = filename.match(/(\d{4})(\d{2})(\d{2})/);
  let outputFilename;

  if (dateMatch) {
    const year = dateMatch[1]; // Keep full 4-digit year
    const month = dateMatch[2];
    const day = dateMatch[3];
    outputFilename = `timew_clean_${year}${month}${day}.json`;
  } else {
    // Fallback if date pattern not found
    const baseName = path.basename(filename, ".json");
    outputFilename = `timew_clean_${baseName}.json`;
  }

  // Export to json/clean folder
  const outputPath = path.join(__dirname, "json", "clean", outputFilename);

  // Ensure the clean directory exists
  const cleanDir = path.join(__dirname, "json", "clean");
  if (!fs.existsSync(cleanDir)) {
    fs.mkdirSync(cleanDir, { recursive: true });
  }

  // Write reformatted data to file
  fs.writeFileSync(outputPath, JSON.stringify(reformattedData, null, 2));

  console.log("Reformatted Results:");
  console.log(JSON.stringify(reformattedData, null, 2));
  console.log(`\nReformatted data exported to: ${outputPath}`);
} catch (error) {
  if (error.code === "ENOENT") {
    console.log("File not found.");
  } else if (error instanceof SyntaxError) {
    console.log("Invalid JSON in file.");
  } else {
    console.log("Error reading file:", error.message);
  }
}
