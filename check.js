const { dbAll } = require('./db/database');

async function check() {
  console.log("== Categories ==");
  const categories = await dbAll("SELECT category, COUNT(*) as count FROM articles GROUP BY category");
  console.table(categories);

  console.log("\n== States ==");
  const states = await dbAll("SELECT state, COUNT(*) as count FROM articles GROUP BY state");
  console.table(states);

  console.log("\n== Blank Check ==");
  const blankCats = await dbAll("SELECT id, title_en FROM articles WHERE category = '' OR category IS NULL");
  console.log("Blank categories:", blankCats.length);

  const blankStates = await dbAll("SELECT id, title_en FROM articles WHERE state = '' OR state IS NULL");
  console.log("Blank states:", blankStates.length);
}

check();
