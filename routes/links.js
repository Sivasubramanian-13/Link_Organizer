const express = require("express");
const router = express.Router();
const { Pool } = require("pg");
const { getAuth } = require("@clerk/express");
const { getAuthenticatedUser } = require("../utils/auth");
const {
  validateUrl,
  validateText,
  validateOptionalText,
} = require("../utils/validation");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Get logged-in user's links
router.get("/", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "User not authenticated",
      });
    }

    const { search, collection_id, favorite } = req.query;

    // Pagination
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit) || 20, 1),
      100
    );
    const offset = (page - 1) * limit;

    const conditions = ["user_id = $1"];
    const values = [user.id];
    let index = 2;

    // Search
    if (search) {
      conditions.push(`
        (
          title ILIKE $${index}
          OR description ILIKE $${index}
          OR url ILIKE $${index}
        )
      `);

      values.push(`%${search}%`);
      index++;
    }

    // Collection filter
    if (collection_id !== undefined) {
      conditions.push(`collection_id = $${index}`);
      values.push(collection_id);
      index++;
    }

    // Favorite filter
    if (favorite !== undefined) {
      if (favorite !== "true" && favorite !== "false") {
        return res.status(400).json({
          error: "favorite must be true or false",
        });
      }

      conditions.push(`is_favorite = $${index}`);
      values.push(favorite === "true");
      index++;
    }

    const whereClause = conditions.join(" AND ");

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) 
       FROM links
       WHERE ${whereClause}`,
      values
    );

    const total = Number(countResult.rows[0].count);

    // Get paginated links
    const result = await pool.query(
      `SELECT *
       FROM links
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${index} OFFSET $${index + 1}`,
      [...values, limit, offset]
    );

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Failed to fetch links:", error);

    res.status(500).json({
      error: "Failed to fetch links",
    });
  }
});

// Create link
router.post("/", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "User not authenticated",
      });
    }

    const { url, title, description, collection_id } = req.body;

    if (!validateUrl(url)) {
      return res.status(400).json({
        error: "Invalid URL",
      });
    }

    const titleError = validateText(title, "title", 200);

    if (titleError) {
      return res.status(400).json({
        error: titleError,
      });
    }

    const descriptionError = validateOptionalText(
      description,
      "description",
      1000
    );

    if (descriptionError) {
      return res.status(400).json({
        error: descriptionError,
      });
    }

    // Make sure collection belongs to this user
    if (collection_id !== undefined && collection_id !== null) {
      const collection = await pool.query(
        `SELECT id FROM collections
         WHERE id = $1 AND user_id = $2`,
        [collection_id, user.id]
      );

      if (collection.rows.length === 0) {
        return res.status(403).json({
          error: "Invalid collection",
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO links
       (user_id, url, title, description, collection_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        user.id,
        url.trim(),
        title.trim(),
        description?.trim() || null,
        collection_id ?? null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Failed to save link:", error);
    res.status(500).json({
      error: "Failed to save link",
    });
  }
});

// Update link
router.patch("/:id", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "User not authenticated",
      });
    }

    const { id } = req.params;
    const { url, title, description, collection_id, is_favorite } = req.body;

    if (url !== undefined && !validateUrl(url)) {
      return res.status(400).json({
        error: "Invalid URL",
      });
    }

    if (title !== undefined) {
      const titleError = validateText(title, "title", 200);

      if (titleError) {
        return res.status(400).json({
          error: titleError,
        });
      }
    }

    if (description !== undefined) {
      const descriptionError = validateOptionalText(
        description,
        "description",
        1000
      );

      if (descriptionError) {
        return res.status(400).json({
          error: descriptionError,
        });
      }
    }

    if (
      is_favorite !== undefined &&
      typeof is_favorite !== "boolean"
    ) {
      return res.status(400).json({
        error: "is_favorite must be a boolean",
      });
    }

    // Check collection ownership
    if (collection_id !== undefined && collection_id !== null) {
      const collection = await pool.query(
        `SELECT id FROM collections
         WHERE id = $1 AND user_id = $2`,
        [collection_id, user.id]
      );

      if (collection.rows.length === 0) {
        return res.status(403).json({
          error: "Invalid collection",
        });
      }
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (url !== undefined) {
      fields.push(`url = $${index++}`);
      values.push(url.trim());
    }

    if (title !== undefined) {
      fields.push(`title = $${index++}`);
      values.push(title.trim());
    }

    if (description !== undefined) {
      fields.push(`description = $${index++}`);
      values.push(description?.trim() || null);
    }

    if (collection_id !== undefined) {
      fields.push(`collection_id = $${index++}`);
      values.push(collection_id);
    }

    if (is_favorite !== undefined) {
      fields.push(`is_favorite = $${index++}`);
      values.push(is_favorite);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        error: "No fields provided for update",
      });
    }

    values.push(id);
    values.push(user.id);

    const result = await pool.query(
      `UPDATE links
       SET ${fields.join(", ")}
       WHERE id = $${index++} AND user_id = $${index}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Link not found",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to update link:", error);
    res.status(500).json({
      error: "Failed to update link",
    });
  }
});

// Delete link
router.delete("/:id", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "User not authenticated",
      });
    }

    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM links
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Link not found",
      });
    }

    res.json({
      message: "Link deleted successfully",
      link: result.rows[0],
    });
  } catch (error) {
    console.error("Failed to delete link:", error);
    res.status(500).json({
      error: "Failed to delete link",
    });
  }
});

module.exports = router;