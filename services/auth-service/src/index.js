require("dotenv").config();

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 4001);
<<<<<<< HEAD

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
=======
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d

const jwtSecret = process.env.JWT_SECRET || "securestay-dev-secret";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "1h";

app.use(express.json());

<<<<<<< HEAD
/* ---------------- Helpers ---------------- */

=======
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
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

<<<<<<< HEAD
/* ---------------- Middleware ---------------- */

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

=======
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }

<<<<<<< HEAD
  const token = authHeader.split(" ")[1];

  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

/* ---------------- Routes (IMPORTANT: API PREFIX ADDED) ---------------- */

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "auth-service" });
});

// Register
app.post("/register", async (req, res) => {
=======
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
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
  const { fullName, email, password } = req.body || {};

  if (!fullName || !email || !password || password.length < 8) {
    return res.status(400).json({ message: "Invalid registration payload" });
  }

<<<<<<< HEAD
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

=======
  const normalizedEmail = String(email).toLowerCase().trim();

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
    if (existing.rowCount > 0) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
<<<<<<< HEAD

=======
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
    const created = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, role, created_at`,
<<<<<<< HEAD
      [fullName, normalizedEmail, passwordHash]
    );

    return res.status(201).json(mapUser(created.rows[0]));
  } catch (err) {
    console.error("Register error:", err);
=======
      [String(fullName).trim(), normalizedEmail, passwordHash]
    );

    return res.status(201).json(mapUser(created.rows[0]));
  } catch (error) {
    console.error("Registration error", error);
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
    return res.status(500).json({ message: "Internal server error" });
  }
});

<<<<<<< HEAD
// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
=======
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  try {
    const result = await pool.query(
      "SELECT id, full_name, email, role, password_hash, created_at FROM users WHERE email = $1",
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
      [normalizedEmail]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
<<<<<<< HEAD

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = createAccessToken(user);

    return res.json({
      accessToken: token,
=======
    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = createAccessToken(user);
    return res.status(200).json({
      accessToken,
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
      tokenType: "Bearer",
      expiresIn: 3600,
      user: mapUser(user)
    });
<<<<<<< HEAD
  } catch (err) {
    console.error("Login error:", err);
=======
  } catch (error) {
    console.error("Login error", error);
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
    return res.status(500).json({ message: "Internal server error" });
  }
});

<<<<<<< HEAD
// Me (protected)
app.get("/me", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE id = $1",
=======
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, full_name, email, role, created_at FROM users WHERE id = $1",
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
      [req.user.sub]
    );

    if (result.rowCount === 0) {
<<<<<<< HEAD
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(mapUser(result.rows[0]));
  } catch (err) {
    console.error("Me error:", err);
=======
      return res.status(401).json({ message: "Missing or invalid token" });
    }

    return res.status(200).json(mapUser(result.rows[0]));
  } catch (error) {
    console.error("Profile error", error);
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
    return res.status(500).json({ message: "Internal server error" });
  }
});

<<<<<<< HEAD
/* ---------------- Start ---------------- */

app.listen(port, () => {
  console.log(`Auth service running on port ${port}`);
=======
app.listen(port, () => {
  console.log(`Auth service listening on port ${port}`);
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
});
