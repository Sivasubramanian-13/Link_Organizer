const express = require("express");
const { Pool } = require("pg");
const {
  clerkMiddleware,
  getAuth,
  clerkClient
} = require("@clerk/express");
const { getOrCreateUser } = require("./utils/user");
require("dotenv").config();

const app = express();

app.use(express.static("public"));
app.use(express.json());
app.use(clerkMiddleware());

const linksRouter = require("./routes/links");
app.use("/api/links", linksRouter);

const collectionsRouter = require("./routes/collections");
app.use("/api/collections", collectionsRouter);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const cors = require("cors");

app.use(cors({
  origin: "https://link-organizer-9u7.pages.dev",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.get("/api/health/db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      message: "Neon database connected!",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);

    res.status(500).json({
      error: "Database connection failed",
    });
  }
});
app.get("/api/auth-test", (req, res) => {
  const { isAuthenticated, userId } = getAuth(req);

  if (!isAuthenticated) {
    return res.status(401).json({
      error: "User not authenticated",
    });
  }

  res.json({
    message: "Authenticated successfully",
    clerkUserId: userId,
  });
});

const PORT = process.env.PORT || 5000;

app.get("/api/user-test", async (req, res) => {
  try {
    const { isAuthenticated, userId } = getAuth(req);

    if (!isAuthenticated) {
      return res.status(401).json({
        error: "User not authenticated",
      });
    }

    const clerkUser = await clerkClient.users.getUser(userId);

    const primaryEmail = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId
    );

    const user = await getOrCreateUser({
      id: clerkUser.id,
      name: [clerkUser.firstName, clerkUser.lastName]
        .filter(Boolean)
        .join(" ") || null,
      email: primaryEmail?.emailAddress || null,
    });

    res.json({
      message: "User synced successfully",
      user,
    });
  } catch (error) {
    console.error("User sync error:", error);

    res.status(500).json({
      error: "Failed to sync user",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});