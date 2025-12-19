#!/usr/bin/env node

const fetchAll = require("./actions/fetchAll");

(async () => {
  const [, , cmd, scope] = process.argv;

  if (cmd !== "fetch" || scope !== "all") {
    console.error("Usage: timewplus fetch all");
    process.exit(1);
  }

  try {
    await fetchAll();
    process.exit(0);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
})();
