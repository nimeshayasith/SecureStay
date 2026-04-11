<<<<<<< HEAD
require("dotenv").config();

=======
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const port = Number(process.env.PORT || 4000);

<<<<<<< HEAD
app.set("trust proxy", true);

const services = {
  auth: process.env.AUTH_SERVICE_URL || "http://auth-service:4001",
  bookings: process.env.BOOKING_SERVICE_URL || "http://booking-service:4002",
  payments: process.env.PAYMENT_SERVICE_URL || "http://payment-service:4003",
  notifications: process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:4004"
};

app.use(morgan("dev"));
app.use(cors());
app.use(express.json());

/* ================= HEALTH ================= */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "gateway" });
});

/* ================= PROXY OPTIONS ================= */
const proxyOptions = (target, pathRewriteRule) => ({
  target,
  changeOrigin: true,
  timeout: 10000,
  proxyTimeout: 10000,
  logLevel: "debug",
  pathRewrite: pathRewriteRule,
  onError(err, req, res) {
    console.error("Proxy error:", err.message);
    res.status(500).json({ message: "Service unavailable" });
  }
});

/* ================= AUTH ================= */
app.use(
  "/api/auth",
  createProxyMiddleware(
    proxyOptions(services.auth, {
      "^/api/auth": ""
    })
  )
);

/* ================= BOOKINGS ================= */
app.use(
  "/api/bookings",
  createProxyMiddleware(
    proxyOptions(services.bookings, {
      "^/api/bookings": ""
    })
  )
);

/* ================= PAYMENTS ================= */
app.use(
  "/api/payments",
  createProxyMiddleware(
    proxyOptions(services.payments, {
      "^/api/payments": ""
    })
  )
);

/* ================= NOTIFICATIONS (ADD THIS) ================= */
app.use(
  "/api/notifications",
  createProxyMiddleware(
    proxyOptions(services.notifications, {
      "^/api/notifications": ""
    })
  )
);

/* ================= 404 ================= */
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.path
  });
});

app.listen(port, () => {
  console.log(`Gateway running on port ${port}`);
=======
const services = {
  auth: process.env.AUTH_SERVICE_URL || "http://localhost:4001",
  bookings: process.env.BOOKING_SERVICE_URL || "http://localhost:4002",
  payments: process.env.PAYMENT_SERVICE_URL || "http://localhost:4003"
};

app.use(morgan("dev"));
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true
  })
);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "gateway" });
});

app.use(
  "/api/auth",
  createProxyMiddleware({
    target: services.auth,
    changeOrigin: true,
    pathRewrite: (path) => `/api/auth${path}`
  })
);

app.use(
  "/api/bookings",
  createProxyMiddleware({
    target: services.bookings,
    changeOrigin: true,
    pathRewrite: (path) => `/api/bookings${path}`
  })
);

app.use(
  "/api/payments",
  createProxyMiddleware({
    target: services.payments,
    changeOrigin: true,
    pathRewrite: (path) => `/api/payments${path}`
  })
);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.listen(port, () => {
  console.log(`Gateway listening on port ${port}`);
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
});
