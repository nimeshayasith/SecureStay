require("dotenv").config();

const express = require("express");
const amqp = require("amqplib");

const app = express();
const port = Number(process.env.PORT || 4004);

const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost:5672";
const eventsExchange = process.env.EVENTS_EXCHANGE || "securestay.events";
const notificationQueue = process.env.NOTIFICATION_QUEUE || "securestay.notifications";

const notifications = [];

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "notification-service" });
});

app.get("/notifications", (_req, res) => {
  res.status(200).json(notifications.slice(-50));
});

async function startConsumer() {
  try {
    const connection = await amqp.connect(rabbitmqUrl);
    const channel = await connection.createChannel();

    await channel.assertExchange(eventsExchange, "topic", { durable: true });
    await channel.assertQueue(notificationQueue, { durable: true });

    await channel.bindQueue(notificationQueue, eventsExchange, "booking.*");
    await channel.bindQueue(notificationQueue, eventsExchange, "payment.*");

    channel.consume(notificationQueue, (message) => {
      if (!message) {
        return;
      }

      try {
        const payload = JSON.parse(message.content.toString("utf8"));
        const logEntry = {
          routingKey: message.fields.routingKey,
          payload,
          receivedAt: new Date().toISOString()
        };

        notifications.push(logEntry);
        console.log("Notification event consumed", logEntry.routingKey, logEntry.payload.eventType);
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

app.listen(port, () => {
  console.log(`Notification service listening on port ${port}`);
  startConsumer();
});
