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
  console.log("Last entry:", lastEndTime);

  if (!lastEndTime) {
    // No entries found, fetch all data from WSL
    const startDate = process.env.START_DATE; // Set your desired start date
    const endDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10); // Yesterday
    const jsonFile = `timew_${startDate.replace(/-/g, "")}-${endDate.replace(
      /-/g,
      ""
    )}.json`;

    // Run timew export in WSL
    const wslCmd = `wsl timew export ${startDate} - ${endDate}`;
    console.log("Running:", wslCmd);
    const output = execSync(wslCmd, { encoding: "utf8" });
    const path = require("path");
    const jsonPath = path.join(__dirname, "..", "..", jsonFile);
    fs.writeFileSync(jsonPath, output);

    // Read and parse the JSON file
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

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
  }

  await client.end();
};
