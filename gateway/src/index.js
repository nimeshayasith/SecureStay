const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const port = Number(process.env.PORT || 4000);

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
});
