require("dotenv").config();
const { Client } = require("pg");
const { execSync } = require("child_process");
const fs = require("fs");
const readline = require("readline");
const { processEntryAnnotation } = require("../utils/projectManager");

// Helper function to convert UTC to Taipei time and get date string
function getDateInTaipei(utcDateString) {
  if (!utcDateString) {
    throw new Error("Date string is null or undefined");
  }

  let normalizedDateString = utcDateString;

  // Convert compact timew format (20251027T012300Z) to standard ISO format (2025-10-27T01:23:00Z)
  if (
    typeof utcDateString === "string" &&
    utcDateString.match(/^\d{8}T\d{6}Z$/)
  ) {
    const year = utcDateString.slice(0, 4);
    const month = utcDateString.slice(4, 6);
    const day = utcDateString.slice(6, 8);
    const hour = utcDateString.slice(9, 11);
    const minute = utcDateString.slice(11, 13);
    const second = utcDateString.slice(13, 15);
    normalizedDateString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }

  const utcDate = new Date(normalizedDateString);

  if (isNaN(utcDate.getTime())) {
    console.error("Invalid date string:", utcDateString);
    console.error("Normalized to:", normalizedDateString);
    throw new Error(`Invalid date format: ${utcDateString}`);
  }

  const taipeiTime = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
  return taipeiTime.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Helper function to prompt user for group type
function askForGroupType(date) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      `Please assign time interval group type for ${date}: `,
      (answer) => {
        rl.close();
        resolve(answer.trim());
      }
    );
  });
}

// Helper function to group entries by Taipei date and get group types
async function getGroupTypesForDates(data) {
  const dateSet = new Set();

  // Collect unique dates in Taipei time
  data.forEach((entry, index) => {
    try {
      if (!entry.start) {
        console.warn(`Entry ${index} has no start time, skipping:`, entry);
        return;
      }
      const taipeiDate = getDateInTaipei(entry.start);
      dateSet.add(taipeiDate);
    } catch (error) {
      console.error(`Error processing entry ${index}:`, error.message);
      console.error("Problematic entry:", JSON.stringify(entry, null, 2));
      throw error;
    }
  });

  const sortedDates = Array.from(dateSet).sort();
  const groupTypes = {};

  // Ask for group type for each date
  for (const date of sortedDates) {
    const groupType = await askForGroupType(date);
    if (!groupType) {
      throw new Error(
        `Group type is required for ${date}. Operation cancelled.`
      );
    }
    groupTypes[date] = groupType;
  }

  return groupTypes;
}

module.exports = async function fetchDateRange(startDate, endDate) {
  console.log(`Fetching entries from ${startDate} to ${endDate}...`);

  const client = new Client({
    host: "localhost",
    port: 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  await client.connect();
  console.log("Connected to DB");

  const path = require("path");

  // Use the provided dates directly
  const jsonFile = `timew_${startDate.replace(/-/g, "")}-${endDate.replace(
    /-/g,
    ""
  )}.json`;

  // First, let's check what data is available in timew for debugging
  console.log("Checking available timew data...");
  try {
    const checkCmd = `wsl timew summary ${startDate}`;
    console.log("Running check:", checkCmd);
    const summaryOutput = execSync(checkCmd, { encoding: "utf8" });
    console.log("Summary output:", summaryOutput);
  } catch (summaryErr) {
    console.log("Summary check failed:", summaryErr.message);
  }

  const wslCmd = `wsl timew export ${startDate} - ${endDate}`;
  console.log("Running export:", wslCmd);

  try {
    const output = execSync(wslCmd, { encoding: "utf8", timeout: 10000 });
    console.log("Raw export output length:", output.length);
    console.log("Raw export output preview:", output.substring(0, 200));

    const jsonPath = path.join(__dirname, "..", "..", jsonFile);
    fs.writeFileSync(jsonPath, output);

    let data;
    try {
      data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr.message);
      console.log("File content:", fs.readFileSync(jsonPath, "utf8"));
      throw parseErr;
    }

    if (data.length === 0) {
      console.log(
        "No entries found with standard export. Trying alternative formats..."
      );

      // Try without the dash separator
      const altCmd1 = `wsl timew export ${startDate}`;
      console.log("Trying:", altCmd1);
      try {
        const altOutput1 = execSync(altCmd1, { encoding: "utf8" });
        console.log("Alternative output length:", altOutput1.length);
        if (altOutput1.trim().length > 2) {
          // More than just "[]"
          fs.writeFileSync(jsonPath, altOutput1);
          data = JSON.parse(altOutput1);
          console.log("Found", data.length, "entries with alternative format");
        }
      } catch (altErr) {
        console.log("Alternative format 1 failed:", altErr.message);
      }

      // If still no data and it's a single date, try with time range
      if (data.length === 0 && startDate === endDate) {
        const altCmd2 = `wsl timew export ${startDate}T00:00:00 - ${startDate}T23:59:59`;
        console.log("Trying with time range:", altCmd2);
        try {
          const altOutput2 = execSync(altCmd2, { encoding: "utf8" });
          console.log("Time range output length:", altOutput2.length);
          if (altOutput2.trim().length > 2) {
            fs.writeFileSync(jsonPath, altOutput2);
            data = JSON.parse(altOutput2);
            console.log("Found", data.length, "entries with time range format");
          }
        } catch (altErr2) {
          console.log("Alternative format 2 failed:", altErr2.message);
        }
      }
    }

    if (data.length === 0) {
      console.log(
        "No entries found in the specified date range after trying multiple formats."
      );
      console.log("This could mean:");
      console.log("1. No time entries exist for this date");
      console.log("2. WSL timezone differs from expected timezone");
      console.log("3. Timew data is in a different location");
    } else {
      // Check for existing entries in the date range to avoid duplicates
      const existingCheck = await client.query(
        `SELECT COUNT(*) as count FROM timewplus_entries 
         WHERE "startTime" >= $1 AND "startTime" < $2`,
        [startDate + "T00:00:00", endDate + "T23:59:59"]
      );

      if (existingCheck.rows[0].count > 0) {
        console.log(
          `Blocked: ${existingCheck.rows[0].count} entries already exist in this date range (${startDate} to ${endDate}).`
        );
        console.log("Insertion blocked to prevent duplicates.");
        fs.unlinkSync(jsonPath); // Delete the JSON file
        await client.end();
        return;
      }

      // Insert each entry into the database
      let insertedCount = 0;

      // Get group types for all dates before inserting
      console.log(
        `Found ${data.length} entries. Getting group types for dates...`
      );
      const groupTypes = await getGroupTypesForDates(data);

      for (const entry of data) {
        try {
          const taipeiDate = getDateInTaipei(entry.start);
          const groupType = groupTypes[taipeiDate];

          // Process annotation to get projectId and parsed annotation
          const { projectId, annotation } = await processEntryAnnotation(
            client,
            entry.annotation
          );

          await client.query(
            `INSERT INTO timewplus_entries ("startTime", "endTime", "sessionName", "projectId", "annotation", "groupType") VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              entry.start,
              entry.end,
              entry.tags[0],
              projectId,
              annotation,
              groupType,
            ]
          );
          insertedCount++;
        } catch (insertErr) {
          console.error(`Error inserting entry: ${insertErr.message}`);
          // Continue with other entries
        }
      }
      console.log(
        `Inserted ${insertedCount} out of ${data.length} entries from date range ${startDate} to ${endDate}.`
      );
    }

    fs.unlinkSync(jsonPath); // Delete the JSON file
  } catch (error) {
    console.error("Error executing timew command:", error.message);
    throw error;
  }

  await client.end();
};
