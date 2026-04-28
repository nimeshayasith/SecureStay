require("dotenv").config();
const express = require("express");
const amqp = require("amqplib");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 4004);
const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://rabbitmq.messaging.svc.cluster.local:5672";
const eventsExchange = process.env.EVENTS_EXCHANGE || "securestay.events";
const notificationQueue = process.env.NOTIFICATION_QUEUE || "securestay.notifications";

const useSslForDatabase =
  process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.includes("sslmode=require") ||
    process.env.NODE_ENV === "production");

function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) return undefined;

  try {
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch (_error) {
    return process.env.DATABASE_URL;
  }
}

const pool = new Pool({
  connectionString: getDatabaseUrl(),
  ssl: useSslForDatabase ? { rejectUnauthorized: false } : undefined
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "notification-service" });
});

app.get("/notifications/logs", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM notification_logs ORDER BY received_at DESC LIMIT 50`
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Failed to fetch notification logs", error.message);
    res.status(500).json({ message: "Failed to fetch logs" });
  }
});

async function startConsumer() {
  try {
    const connection = await amqp.connect(rabbitmqUrl);
    const channel = await connection.createChannel();
    await channel.assertExchange(eventsExchange, "topic", { durable: true });
    await channel.assertQueue(notificationQueue, { durable: true });
    await channel.bindQueue(notificationQueue, eventsExchange, "booking.*");
    await channel.bindQueue(notificationQueue, eventsExchange, "payment.*");

    channel.consume(notificationQueue, async (message) => {
      if (!message) return;
      try {
        const data = JSON.parse(message.content.toString("utf8"));

        await pool.query(
          `INSERT INTO notification_logs (routing_key, event_type, payload, status, received_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [message.fields.routingKey, data.eventType || "unknown", JSON.stringify(data), "delivered"]
        );

        console.log("Notification event persisted:", message.fields.routingKey);
        channel.ack(message);
      } catch (error) {
        console.error("Failed to consume notification message", error.message);
        channel.nack(message, false, false);
      }
    });

    console.log("Notification service consuming events from RabbitMQ");
  } catch (error) {
    console.error("Notification consumer failed to start", error.message);
  }
}

app.listen(port, () => {
  console.log(`Notification service listening on port ${port}`);
  startConsumer();
});
