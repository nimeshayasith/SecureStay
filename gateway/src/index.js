require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const port = Number(process.env.PORT || 4000);

app.set("trust proxy", true);

const services = {
  auth: process.env.AUTH_SERVICE_URL || "http://auth-service:4001",
  bookings: process.env.BOOKING_SERVICE_URL || "http://booking-service:4002",
  payments: process.env.PAYMENT_SERVICE_URL || "http://payment-service:4003",
  notifications: process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:4004"
};

app.use(morgan("dev"));
app.use(cors());


/* ================= HEALTH ================= */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "gateway" });
});

/* ================= PROXY OPTIONS ================= */
// pathRewrite is optional — only pass it when the service needs path transformation
const proxyOptions = (target, pathRewriteRule) => ({
  target,
  changeOrigin: true,
  timeout: 10000,
  proxyTimeout: 10000,
  logLevel: "debug",
  ...(pathRewriteRule && { pathRewrite: pathRewriteRule }),
  onError(err, req, res) {
    console.error("Proxy error:", err.message);
    res.status(500).json({ message: "Service unavailable" });
  }
});

/* ================= AUTH ===================
   Auth service routes: /register  /login  /me  /health
   Gateway receives:    /api/auth/register
   Rewrite strips /api/auth → "" so service sees /register  ✓
*/
app.use(
  "/api/auth",
  createProxyMiddleware(
    proxyOptions(services.auth, { "^/api/auth": "" })
  )
);

/* ================= BLOCK INTERNAL ROUTES =================
   Internal routes are for service-to-service communication only.
   They must never be accessible through the public gateway.
*/
app.use("/api/bookings/internal", (_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use("/api/payments/internal", (_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

/* ================= BOOKINGS ================
   Booking service routes: /api/bookings/hotels  /api/bookings/rooms  etc.
   Gateway receives:        /api/bookings/hotels
   NO rewrite — forward the full path as-is so service sees /api/bookings/hotels  ✓
   FIX: removed pathRewrite that was stripping /api/bookings → "" causing 404s
*/
app.use(
  "/api/bookings",
  createProxyMiddleware(
    proxyOptions(services.bookings, { "^/": "/api/bookings/" })
  )
);

/* ================= PAYMENTS ================
   Payment service routes: /api/payments/  /api/payments/:id
   Gateway receives:        /api/payments/
   NO rewrite — same reason as bookings  ✓
   FIX: removed pathRewrite that was stripping /api/payments → "" causing 404s
*/
app.use(
  "/api/payments",
  createProxyMiddleware(
    proxyOptions(services.payments, { "^/": "/api/payments/" })
  )
);
/* ================= NOTIFICATIONS ===========
   Notification service routes: /notifications  /notifications/logs
   Gateway receives:             /api/notifications  /api/notifications/logs
   Rewrite: /api/notifications → /notifications  ✓
   FIX: was rewriting to "" which gave the service an empty path → 404
*/
app.use(
  "/api/notifications",
  createProxyMiddleware(
    proxyOptions(services.notifications, { "^/": "/notifications" })
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
});
