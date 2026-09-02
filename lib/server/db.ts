import mysql from "mysql2/promise";

// Module-scope singleton so the pool is reused across invocations on a warm
// serverless instance instead of opening a fresh set of connections each time.
// Keep connectionLimit low — Cloud SQL's max_connections is shared with other
// KD systems, and this app's real traffic doesn't need more.
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 5,
  waitForConnections: true,
  queueLimit: 0,
});
