require("dotenv").config();

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 4001);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const jwtSecret = process.env.JWT_SECRET || "securestay-dev-secret";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "1h";

app.use(express.json());

function mapUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at
  };
}

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }

  const token = authHeader.slice("Bearer ".length);
  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }
}

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "auth-service" });
});

app.post("/api/auth/register", async (req, res) => {
  const { fullName, email, password } = req.body || {};

  if (!fullName || !email || !password || password.length < 8) {
    return res.status(400).json({ message: "Invalid registration payload" });
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, role, created_at`,
      [String(fullName).trim(), normalizedEmail, passwordHash]
    );

    return res.status(201).json(mapUser(created.rows[0]));
  } catch (error) {
    console.error("Registration error", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  try {
    const result = await pool.query(
      "SELECT id, full_name, email, role, password_hash, created_at FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = createAccessToken(user);
    return res.status(200).json({
      accessToken,
      tokenType: "Bearer",
      expiresIn: 3600,
      user: mapUser(user)
    });
  } catch (error) {
    console.error("Login error", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, full_name, email, role, created_at FROM users WHERE id = $1",
      [req.user.sub]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Missing or invalid token" });
    }

    return res.status(200).json(mapUser(result.rows[0]));
  } catch (error) {
    console.error("Profile error", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Auth service listening on port ${port}`);
});
