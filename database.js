const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./ratings.db");

db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS ratings (userId TEXT PRIMARY KEY, points INTEGER, reviews INTEGER)");
  db.run("CREATE TABLE IF NOT EXISTS whitelist (userId TEXT PRIMARY KEY)");
});

module.exports = db;
