# Step 04: Service Implementation Scaffold

This step converts the SecureStay database and API contracts into a runnable MVP service stack.

## Added components

- API Gateway (`gateway/`) for a single entry point
- Frontend (`frontend/`) single-page app for user flows
- Auth Service (`services/auth-service/`)
- Booking Service (`services/booking-service/`)
- Payment Service (`services/payment-service/`)
- Notification Service (`services/notification-service/`)
- Docker Compose setup for PostgreSQL, RabbitMQ, and all services

## Public endpoints (through Gateway)

- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`
- Booking: `/api/bookings/hotels`, `/api/bookings/rooms`, `/api/bookings/availability`, `/api/bookings/`, `/api/bookings/{bookingId}`
- Payment: `/api/payments/`, `/api/payments/{paymentId}`

## Internal service endpoints

Booking Service exposes internal endpoints used by Payment Service orchestration:

- `GET /internal/bookings/{bookingId}`
- `PATCH /internal/bookings/{bookingId}/status`

## Event flow

- Booking Service publishes `booking.created` and `booking.status.updated`
- Payment Service publishes `payment.processed`
- Notification Service subscribes to `booking.*` and `payment.*`

## Local run

1. Ensure Docker is running.
2. From repository root, run:

```bash
docker compose up --build
```

3. Gateway is available at `http://localhost:4000`.
4. RabbitMQ Management UI is available at `http://localhost:15672`.
5. Frontend is available at `http://localhost:3001`.

## One-command integration smoke test

Run this from repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\integration-smoke.ps1
```

What it validates:

- gateway and service health
- auth register/login/profile
- hotel, room, and availability browsing
- booking creation
- payment success path and booking confirmation
- payment failure path and booking failure
- RabbitMQ event consumption by notification service

## Notes

- Payment success is currently simulated: CVV `000` forces a failed payment; other values succeed.
- `database/schema.sql` is mounted into PostgreSQL at startup and initializes the schema + seed data.
- Service env files are currently `.env.example` and are directly referenced in `docker-compose.yml` for quick start.
