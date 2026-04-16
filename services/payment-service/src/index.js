require("dotenv").config();

const express = require("express");
const jwt = require("jsonwebtoken");
const amqp = require("amqplib");
const axios = require("axios");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 4003);
const useSslForDatabase =
  process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.includes("sslmode=require") ||
    process.env.NODE_ENV === "production");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSslForDatabase ? { rejectUnauthorized: false } : undefined
});
const jwtSecret = process.env.JWT_SECRET || "securestay-dev-secret";
const bookingServiceInternalUrl =
  process.env.BOOKING_SERVICE_INTERNAL_URL || "http://localhost:4002";

const rabbitmqUrl =
  process.env.RABBITMQ_URL || "amqp://rabbitmq.messaging.svc.cluster.local:5672";
const paymentEventsExchange =
  process.env.PAYMENT_EVENTS_EXCHANGE || "securestay.events";
let eventChannel;

app.use(express.json());

// FIX: added retry loop identical to booking-service so RabbitMQ startup
// race conditions don't silently drop all payment events forever
async function initRabbitMq(retries = 10) {
  while (retries > 0) {
    try {
      const connection = await amqp.connect(rabbitmqUrl);
      eventChannel = await connection.createChannel();
      await eventChannel.assertExchange(paymentEventsExchange, "topic", {
        durable: true
      });
      console.log("Payment service connected to RabbitMQ");
      return;
    } catch (error) {
      console.error(
        "Payment service RabbitMQ connection failed, retrying...",
        error.message
      );
      retries--;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  console.error("Payment service RabbitMQ connection failed permanently");
}

async function publishEvent(routingKey, payload) {
  if (!eventChannel) {
    console.error("RabbitMQ channel not ready. Event dropped:", routingKey);
    return;
  }

  try {
    eventChannel.publish(
      paymentEventsExchange,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { contentType: "application/json", persistent: true }
    );
    console.log("Event published:", routingKey);
  } catch (err) {
    console.error("Failed to publish event:", err.message);
  }
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

function maskCardNumber(cardNumber) {
  const raw = String(cardNumber || "").replace(/\s+/g, "");
  const last4 = raw.slice(-4);
  const stars = "*".repeat(Math.max(0, raw.length - 4));
  return `${stars}${last4}`;
}

function mapPayment(row) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    amount: Number(row.amount),
    currency: row.currency,
    paymentMethod: row.payment_method,
    transactionReference: row.transaction_reference,
    status: row.status,
    maskedCardNumber: row.masked_card_number,
    processedAt: row.processed_at
  };
}

async function getBooking(bookingId) {
  const response = await axios.get(
    `${bookingServiceInternalUrl}/internal/bookings/${bookingId}`
  );
  return response.data;
}

async function updateBookingStatus(bookingId, status) {
  await axios.patch(
    `${bookingServiceInternalUrl}/internal/bookings/${bookingId}/status`,
    { status }
  );
}

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "payment-service" });
});

app.post("/api/payments/", authMiddleware, async (req, res) => {
  const {
    bookingId,
    amount,
    paymentMethod,
    cardNumber,
    cardHolderName,
    expiryMonth,
    expiryYear,
    cvv
  } = req.body || {};

  if (
    !bookingId ||
    amount == null ||
    !paymentMethod ||
    !cardNumber ||
    !cardHolderName ||
    !expiryMonth ||
    !expiryYear ||
    !cvv
  ) {
    return res.status(400).json({ message: "Invalid payment payload" });
  }

  try {
    const existingPayment = await pool.query(
      "SELECT id FROM payments WHERE booking_id = $1",
      [bookingId]
    );
    if (existingPayment.rowCount > 0) {
      return res
        .status(400)
        .json({ message: "Payment already exists for booking" });
    }

    let booking;
    try {
      booking = await getBooking(bookingId);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return res.status(404).json({ message: "Booking not found" });
      }
      throw error;
    }

    if (booking.userId !== req.user.sub && req.user.role !== "ADMIN") {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (Number(amount) !== Number(booking.totalAmount)) {
      return res
        .status(400)
        .json({ message: "Payment amount does not match booking total" });
    }

    const paymentSucceeded = String(cvv) !== "000";
    const paymentStatus = paymentSucceeded ? "SUCCESS" : "FAILED";
    const bookingStatus = paymentSucceeded ? "CONFIRMED" : "FAILED";

    const created = await pool.query(
      `INSERT INTO payments (
         booking_id, amount, payment_method, transaction_reference,
         status, masked_card_number, processed_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, booking_id, amount, currency, payment_method,
                 transaction_reference, status, masked_card_number, processed_at`,
      [
        bookingId,
        amount,
        paymentMethod,
        `TXN-${Date.now()}`,
        paymentStatus,
        maskCardNumber(cardNumber)
      ]
    );

    await updateBookingStatus(bookingId, bookingStatus);

    const payment = mapPayment(created.rows[0]);

    await publishEvent("payment.processed", {
      eventType: "payment.processed",
      occurredAt: new Date().toISOString(),
      payment,
      bookingStatus
    });

    return res.status(201).json(payment);
  } catch (error) {
    console.error("Create payment error", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/payments/:paymentId", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, booking_id, amount, currency, payment_method,
              transaction_reference, status, masked_card_number, processed_at
       FROM payments
       WHERE id = $1`,
      [req.params.paymentId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Payment not found" });
    }

    return res.status(200).json(mapPayment(result.rows[0]));
  } catch (error) {
    console.error("Get payment error", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// FIX: use startService pattern (same as booking-service) so RabbitMQ
// retry completes before the HTTP server starts accepting requests
async function startService() {
  await initRabbitMq();
  app.listen(port, () => {
    console.log(`Payment service listening on port ${port}`);
  });
}

startService();
