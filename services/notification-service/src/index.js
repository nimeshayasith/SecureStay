require("dotenv").config();
const express = require("express");
const amqp = require("amqplib");
const { MongoClient } = require("mongodb");

const app = express();
const port = Number(process.env.PORT || 4004);
const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://rabbitmq.default.svc.cluster.local:5672";
const mongoUrl = process.env.MONGODB_URL || "mongodb://localhost:27017";
const eventsExchange = process.env.EVENTS_EXCHANGE || "securestay.events";
const notificationQueue = process.env.NOTIFICATION_QUEUE || "securestay.notifications";

const notifications = [];
let db;

// ✅ NEW — connect to MongoDB
async function initMongo() {
  try {
    const client = new MongoClient(mongoUrl);
    await client.connect();
    db = client.db("securestay_notifications");
    console.log("Notification service connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection failed", error.message);
  }
}

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "notification-service" });
});

app.get("/notifications", (_req, res) => {
  res.status(200).json(notifications.slice(-50));
});

// ✅ NEW — get logs from MongoDB
app.get("/notifications/logs", async (_req, res) => {
  try {
    const logs = await db.collection("notification_logs").find().sort({ receivedAt: -1 }).limit(50).toArray();
    res.status(200).json(logs);
  } catch (error) {
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
        const payload = JSON.parse(message.content.toString("utf8"));
        const logEntry = {
          routingKey: message.fields.routingKey,
          payload,
          receivedAt: new Date().toISOString()
        };

        // keep in memory (existing)
        notifications.push(logEntry);
        console.log("Notification event consumed", logEntry.routingKey, logEntry.payload.eventType);

        // ✅ NEW — also save to MongoDB
        if (db) {
          await db.collection("notification_logs").insertOne(logEntry);
        }

        channel.ack(message);
      } catch (error) {
        console.error("Failed to consume notification message", error);
        channel.nack(message, false, false);
      }
    });

    console.log("Notification service consuming events");
  } catch (error) {
    console.error("Notification consumer failed to start", error.message);
  }
}

// ✅ init MongoDB first, then start server
initMongo().then(() => {
  app.listen(port, () => {
    console.log(`Notification service listening on port ${port}`);
    startConsumer();
  });
});
