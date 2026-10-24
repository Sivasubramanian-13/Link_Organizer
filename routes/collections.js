const express = require("express");
const router = express.Router();
const { Pool } = require("pg");
const { getAuthenticatedUser } = require("../utils/auth");
const { validateText } = require("../utils/validation");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Get logged-in user's collections
router.get("/", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "User not authenticated",
      });
    }

    const result = await pool.query(
      `SELECT * FROM collections
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Failed to fetch collections:", error);

    res.status(500).json({
      error: "Failed to fetch collections",
    });
  }
});

// Create collection
router.post("/", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "User not authenticated",
      });
    }

    const { name } = req.body;

    const nameError = validateText(name, "name", 100);

    if (nameError) {
      return res.status(400).json({
        error: nameError,
      });
    }

    const result = await pool.query(
      `INSERT INTO collections (user_id, name)
       VALUES ($1, $2)
       RETURNING *`,
      [user.id, name.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Failed to create collection:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "Collection already exists",
      });
    }

    res.status(500).json({
      error: "Failed to create collection",
    });
  }
});

// Update collection
router.patch("/:id", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "User not authenticated",
      });
    }

    const { id } = req.params;
    const { name } = req.body;

    if (name === undefined) {
      return res.status(400).json({
        error: "No fields provided for update",
      });
    }

    const nameError = validateText(name, "name", 100);

    if (nameError) {
      return res.status(400).json({
        error: nameError,
      });
    }

    const result = await pool.query(
      `UPDATE collections
       SET name = $1
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [name.trim(), id, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Collection not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to update collection:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "Collection already exists",
      });
    }

    res.status(500).json({
      error: "Failed to update collection",
    });
  }
});

// Delete collection
router.delete("/:id", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "User not authenticated",
      });
    }

    const { id } = req.params;
    const deleteLinks = req.query.deleteLinks === "true";

    // Delete links first if requested
    if (deleteLinks) {
      await pool.query(
        `DELETE FROM links
         WHERE collection_id = $1 AND user_id = $2`,
        [id, user.id]
      );
    }

    // Delete collection
    const result = await pool.query(
      `DELETE FROM collections
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Collection not found",
      });
    }

    res.json({
      message: deleteLinks
        ? "Collection and its links deleted successfully"
        : "Collection deleted successfully",
      collection: result.rows[0],
    });
  } catch (error) {
    console.error("Failed to delete collection:", error);

    res.status(500).json({
      error: "Failed to delete collection",
    });
  }
});

module.exports = router;