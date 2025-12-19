require("dotenv").config();
const { Client } = require("pg");
const { execSync } = require("child_process");
const fs = require("fs");
const readline = require("readline");

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

module.exports = async function fetchAll() {
  console.log("Fetching all missing logs...");

  const client = new Client({
    host: "localhost",
    port: 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  await client.connect();
  console.log("Connected to DB");

  const res = await client.query(`
  SELECT "endTime"
  FROM timewplus_entries
  ORDER BY "endTime" DESC
  LIMIT 1
`);

  const lastEndTime = res.rows[0]?.endTime;
  // Convert to Taipei time for display (UTC+8)
  const lastEndTimeTaipei = lastEndTime
    ? new Date(new Date(lastEndTime).getTime() + 8 * 60 * 60 * 1000)
    : null;
  console.log(
    "Last entry:",
    lastEndTimeTaipei?.toISOString().replace("T", " ").slice(0, 19) +
      " (Taipei)"
  );

  const path = require("path");
  let startDate, endDate, jsonFile, wslCmd, output, jsonPath, data;
  if (!lastEndTime) {
    // No entries found, fetch all data from WSL
    startDate = process.env.START_DATE; // Set your desired start date
    // Use yesterday in Taipei time to exclude today
    const nowTaipei = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
    const yesterday = new Date(nowTaipei.getTime() - 24 * 60 * 60 * 1000);
    endDate = yesterday.toISOString().slice(0, 10); // Yesterday in Taipei
    jsonFile = `timew_${startDate.replace(/-/g, "")}-${endDate.replace(
      /-/g,
      ""
    )}.json`;
    wslCmd = `wsl timew export ${startDate} - ${endDate}`;
    console.log("Running:", wslCmd);
    output = execSync(wslCmd, { encoding: "utf8" });
    jsonPath = path.join(__dirname, "..", "..", jsonFile);
    fs.writeFileSync(jsonPath, output);
    data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    // Get group types for all dates before inserting
    console.log(
      `Found ${data.length} entries. Getting group types for dates...`
    );
    const groupTypes = await getGroupTypesForDates(data);

    // Insert each entry into the database
    for (const entry of data) {
      const taipeiDate = getDateInTaipei(entry.start);
      const groupType = groupTypes[taipeiDate];

      await client.query(
        `INSERT INTO timewplus_entries ("startTime", "endTime", "sessionName", "projectName", "annotation", "groupType") VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          entry.start,
          entry.end,
          entry.tags[0],
          entry.annotation,
          entry.annotation,
          groupType,
        ]
      );
    }
    console.log("Inserted entries from JSON export.");
    fs.unlinkSync(jsonPath); // Delete the JSON file
  } else {
    // Entries exist, fetch only new data from WSL after lastEndTime
    // Convert to Taipei time (UTC+8) for WSL command
    const lastTaipei = new Date(
      new Date(lastEndTime).getTime() + 8 * 60 * 60 * 1000
    );
    startDate = lastTaipei.toISOString().slice(0, 19); // YYYY-MM-DDTHH:MM:SS
    // End date: yesterday in Taipei time to exclude today
    const nowTaipei = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
    const yesterday = new Date(nowTaipei.getTime() - 24 * 60 * 60 * 1000);
    endDate = yesterday.toISOString().slice(0, 10); // Yesterday in Taipei
    jsonFile = `timew_${startDate.replace(/[-T:]/g, "")}-${endDate.replace(
      /-/g,
      ""
    )}.json`;
    // Use dash as separator, both ISO format
    wslCmd = `wsl timew export ${startDate} - ${endDate}`;
    console.log("Running:", wslCmd);
    output = execSync(wslCmd, { encoding: "utf8" });
    jsonPath = path.join(__dirname, "..", "..", jsonFile);
    fs.writeFileSync(jsonPath, output);
    data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    // Get group types for all dates before inserting
    console.log(
      `Found ${data.length} entries. Getting group types for dates...`
    );
    const groupTypes = await getGroupTypesForDates(data);

    // Insert each entry into the database
    for (const entry of data) {
      const taipeiDate = getDateInTaipei(entry.start);
      const groupType = groupTypes[taipeiDate];

      await client.query(
        `INSERT INTO timewplus_entries ("startTime", "endTime", "sessionName", "projectName", "annotation", "groupType") VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          entry.start,
          entry.end,
          entry.tags[0],
          entry.annotation,
          entry.annotation,
          groupType,
        ]
      );
    }
    console.log("Inserted new entries from JSON export after lastEndTime.");
    fs.unlinkSync(jsonPath); // Delete the JSON file
  }

  await client.end();
};
