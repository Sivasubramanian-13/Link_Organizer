const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function getOrCreateUser(clerkUser) {
  const { id, name, email } = clerkUser;

  const existing = await pool.query(
    "SELECT * FROM users WHERE clerk_user_id = $1",
    [id]
  );

  if (existing.rows.length > 0) {
    const result = await pool.query(
      `UPDATE users
       SET name = $1,
           email = $2
       WHERE clerk_user_id = $3
       RETURNING *`,
      [name, email, id]
    );

    return result.rows[0];
  }

  const result = await pool.query(
    `INSERT INTO users (clerk_user_id, name, email)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [id, name, email]
  );

  return result.rows[0];
}

module.exports = { getOrCreateUser };