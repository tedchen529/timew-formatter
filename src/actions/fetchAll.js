require("dotenv").config();
const { Client } = require("pg");
const { execSync } = require("child_process");
const fs = require("fs");

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
    // Insert each entry into the database
    for (const entry of data) {
      await client.query(
        `INSERT INTO timewplus_entries ("startTime", "endTime", "sessionName", "projectName", "annotation", "groupType") VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          entry.start,
          entry.end,
          entry.tags[0],
          entry.annotation,
          entry.annotation,
          entry.annotation,
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
    // Insert each entry into the database
    for (const entry of data) {
      await client.query(
        `INSERT INTO timewplus_entries ("startTime", "endTime", "sessionName", "projectName", "annotation", "groupType") VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          entry.start,
          entry.end,
          entry.tags[0],
          entry.annotation,
          entry.annotation,
          entry.annotation,
        ]
      );
    }
    console.log("Inserted new entries from JSON export after lastEndTime.");
    fs.unlinkSync(jsonPath); // Delete the JSON file
  }

  await client.end();
};
