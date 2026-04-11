require("dotenv").config();

const express = require("express");
const jwt = require("jsonwebtoken");
const amqp = require("amqplib");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 4002);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const jwtSecret = process.env.JWT_SECRET || "securestay-dev-secret";

<<<<<<< HEAD
const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://rabbitmq.default.svc.cluster.local:5672";
=======
const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost:5672";
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
const bookingEventsExchange = process.env.BOOKING_EVENTS_EXCHANGE || "securestay.events";
let eventChannel;

app.use(express.json());

<<<<<<< HEAD
async function initRabbitMq(retries = 10) {
  while (retries > 0) {
    try {
      const connection = await amqp.connect(rabbitmqUrl);
      eventChannel = await connection.createChannel();
      await eventChannel.assertExchange(bookingEventsExchange, "topic", {
        durable: true
      });

      console.log("Booking service connected to RabbitMQ");
      return;
    } catch (error) {
      console.error("RabbitMQ connection failed, retrying...", error.message);
      retries--;

      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  console.error("RabbitMQ connection failed permanently");
=======
async function initRabbitMq() {
  try {
    const connection = await amqp.connect(rabbitmqUrl);
    eventChannel = await connection.createChannel();
    await eventChannel.assertExchange(bookingEventsExchange, "topic", { durable: true });
    console.log("Booking service connected to RabbitMQ");
  } catch (error) {
    console.error("Booking service RabbitMQ init failed", error.message);
  }
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
}

async function publishEvent(routingKey, payload) {
  if (!eventChannel) {
<<<<<<< HEAD
    console.error("❌ RabbitMQ channel not ready. Event dropped:", routingKey);
    return;
  }

  try {
    eventChannel.publish(
      bookingEventsExchange,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { contentType: "application/json", persistent: true }
    );

    console.log("📤 Event published:", routingKey);
  } catch (err) {
    console.error("❌ Failed to publish event:", err.message);
  }
=======
    return;
  }

  eventChannel.publish(
    bookingEventsExchange,
    routingKey,
    Buffer.from(JSON.stringify(payload)),
    { contentType: "application/json", persistent: true }
  );
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
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

function mapHotel(row) {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    address: row.address,
    description: row.description
  };
}

function mapRoom(row) {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    roomNumber: row.room_number,
    roomType: row.room_type,
    pricePerNight: Number(row.price_per_night),
    capacity: row.capacity,
    isActive: row.is_active
  };
}

function mapBooking(row) {
  return {
    id: row.id,
    userId: row.user_id,
    roomId: row.room_id,
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    totalAmount: Number(row.total_amount),
    status: row.status,
    guestCount: row.guest_count,
    createdAt: row.created_at
  };
}

async function isRoomAvailable(roomId, checkInDate, checkOutDate) {
  const overlap = await pool.query(
    `SELECT id
     FROM bookings
     WHERE room_id = $1
       AND status IN ('PENDING', 'CONFIRMED')
       AND NOT ($3 <= check_in_date OR $2 >= check_out_date)
     LIMIT 1`,
    [roomId, checkInDate, checkOutDate]
  );

  return overlap.rowCount === 0;
}

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "booking-service" });
});

app.get("/api/bookings/hotels", async (req, res) => {
  const { city } = req.query;

  try {
    const result = city
      ? await pool.query(
          "SELECT id, name, city, address, description FROM hotels WHERE city ILIKE $1 ORDER BY name",
          [city]
        )
      : await pool.query("SELECT id, name, city, address, description FROM hotels ORDER BY name");

    return res.status(200).json(result.rows.map(mapHotel));
  } catch (error) {
    console.error("List hotels error", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/bookings/rooms", async (req, res) => {
  const { hotelId } = req.query;

  if (!hotelId) {
    return res.status(400).json({ message: "Missing hotelId" });
  }

  try {
    const result = await pool.query(
      `SELECT id, hotel_id, room_number, room_type, price_per_night, capacity, is_active
       FROM rooms
       WHERE hotel_id = $1
       ORDER BY room_number`,
      [hotelId]
    );

    return res.status(200).json(result.rows.map(mapRoom));
  } catch (error) {
    console.error("List rooms error", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/bookings/availability", async (req, res) => {
  const { roomId, checkInDate, checkOutDate } = req.query;

  if (!roomId || !checkInDate || !checkOutDate) {
    return res.status(400).json({ message: "roomId, checkInDate and checkOutDate are required" });
  }

  if (new Date(checkOutDate) <= new Date(checkInDate)) {
    return res.status(400).json({ message: "checkOutDate must be after checkInDate" });
  }

  try {
    const available = await isRoomAvailable(roomId, checkInDate, checkOutDate);
    return res.status(200).json({ roomId, available });
  } catch (error) {
    console.error("Availability check error", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

<<<<<<< HEAD
app.post("/api/bookings/", async (req, res) => {
=======
app.post("/api/bookings/", authMiddleware, async (req, res) => {
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
  const { roomId, checkInDate, checkOutDate, guestCount } = req.body || {};

  if (!roomId || !checkInDate || !checkOutDate || !guestCount || Number(guestCount) < 1) {
    return res.status(400).json({ message: "Invalid booking payload" });
  }

  if (new Date(checkOutDate) <= new Date(checkInDate)) {
    return res.status(400).json({ message: "checkOutDate must be after checkInDate" });
  }

  try {
    const roomResult = await pool.query(
      "SELECT id, capacity, price_per_night, is_active FROM rooms WHERE id = $1",
      [roomId]
    );

    if (roomResult.rowCount === 0 || !roomResult.rows[0].is_active) {
      return res.status(400).json({ message: "Room unavailable" });
    }

    const room = roomResult.rows[0];

    if (Number(guestCount) > room.capacity) {
      return res.status(400).json({ message: "Guest count exceeds room capacity" });
    }

    const available = await isRoomAvailable(roomId, checkInDate, checkOutDate);
    if (!available) {
      return res.status(400).json({ message: "Room unavailable for selected dates" });
    }

    const nights = Math.ceil(
      (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalAmount = Number(room.price_per_night) * nights;

    const created = await pool.query(
      `INSERT INTO bookings (user_id, room_id, check_in_date, check_out_date, total_amount, guest_count, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
       RETURNING id, user_id, room_id, check_in_date, check_out_date, total_amount, status, guest_count, created_at`,
      [req.user.sub, roomId, checkInDate, checkOutDate, totalAmount, guestCount]
    );

    const booking = mapBooking(created.rows[0]);

    await publishEvent("booking.created", {
      eventType: "booking.created",
      occurredAt: new Date().toISOString(),
      booking
    });

    return res.status(201).json(booking);
  } catch (error) {
    console.error("Create booking error", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/bookings/:bookingId", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, user_id, room_id, check_in_date, check_out_date, total_amount, status, guest_count, created_at
       FROM bookings
       WHERE id = $1`,
      [req.params.bookingId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const booking = result.rows[0];

    if (booking.user_id !== req.user.sub && req.user.role !== "ADMIN") {
      return res.status(404).json({ message: "Booking not found" });
    }

    return res.status(200).json(mapBooking(booking));
  } catch (error) {
    console.error("Get booking error", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Internal service endpoint for payment orchestration.
app.get("/internal/bookings/:bookingId", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, user_id, room_id, check_in_date, check_out_date, total_amount, status, guest_count, created_at
       FROM bookings
       WHERE id = $1`,
      [req.params.bookingId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    return res.status(200).json(mapBooking(result.rows[0]));
  } catch (error) {
    console.error("Internal get booking error", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Internal service endpoint for payment orchestration.
app.patch("/internal/bookings/:bookingId/status", async (req, res) => {
  const { status } = req.body || {};

  if (!["PENDING", "CONFIRMED", "FAILED", "CANCELLED"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    const updated = await pool.query(
      `UPDATE bookings
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, room_id, check_in_date, check_out_date, total_amount, status, guest_count, created_at`,
      [req.params.bookingId, status]
    );

    if (updated.rowCount === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const booking = mapBooking(updated.rows[0]);

    await publishEvent("booking.status.updated", {
      eventType: "booking.status.updated",
      occurredAt: new Date().toISOString(),
      booking
    });

    return res.status(200).json(booking);
  } catch (error) {
    console.error("Internal update booking status error", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

<<<<<<< HEAD
async function startService() {
  await initRabbitMq();

  app.listen(port, () => {
    console.log(`Booking service listening on port ${port}`);
  });
}

startService();
=======
initRabbitMq().then(() => {
  app.listen(port, () => {
    console.log(`Booking service listening on port ${port}`);
  });
});
>>>>>>> 79de00c96b73598f7ad312ea3e3ce77cd3c7249d
