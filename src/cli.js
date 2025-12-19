#!/usr/bin/env node

const fetchAll = require("./actions/fetchAll");
const fetchDateRange = require("./actions/fetchDateRange");

(async () => {
  const args = process.argv.slice(2);

  if (args.length < 2 || args[0] !== "fetch") {
    console.error("Usage:");
    console.error("  timewplus fetch all");
    console.error("  timewplus fetch YYYY-MM-DD");
    console.error("  timewplus fetch YYYY-MM-DD - YYYY-MM-DD");
    process.exit(1);
  }

  const [cmd, ...rest] = args;

  try {
    if (rest[0] === "all") {
      await fetchAll();
    } else if (rest.length === 1) {
      // Single date: YYYY-MM-DD
      const date = rest[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        console.error("Invalid date format. Use YYYY-MM-DD");
        process.exit(1);
      }
      await fetchDateRange(date, date);
    } else if (rest.length === 3 && rest[1] === "-") {
      // Date range: YYYY-MM-DD - YYYY-MM-DD
      const [startDate, dash, endDate] = rest;
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ) {
        console.error("Invalid date format. Use YYYY-MM-DD - YYYY-MM-DD");
        process.exit(1);
      }
      await fetchDateRange(startDate, endDate);
    } else {
      console.error("Usage:");
      console.error("  timewplus fetch all");
      console.error("  timewplus fetch YYYY-MM-DD");
      console.error("  timewplus fetch YYYY-MM-DD - YYYY-MM-DD");
      process.exit(1);
    }

    process.exit(0);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
})();
