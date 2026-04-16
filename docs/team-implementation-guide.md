# SecureStay Team Implementation Guide

This guide is the practical handover document for the current SecureStay MVP implementation.

It explains:

- what has been implemented
- how to run the full system
- how to use the frontend and APIs
- how to inspect PostgreSQL data with PgAdmin
- how to run automated tests
- common troubleshooting steps

Related reading:

- See [errors_fix.md](./errors_fix.md) for the two-day deployment troubleshooting summary, root causes, solutions, lessons learned, and best practices.

## 1. What Is Implemented

The project now includes a complete MVP backend + simple frontend:

- API Gateway
- Auth Service
- Booking Service
- Payment Service
- Notification Service
- PostgreSQL
- RabbitMQ
- Frontend single-page app
- Integration smoke test script

## 2. Current Project Structure

```text
contracts/
database/
docs/
frontend/
gateway/
scripts/
services/
  auth-service/
  booking-service/
  payment-service/
  notification-service/
docker-compose.yml
```

## 3. Service Responsibilities

### Frontend (`frontend/`)

- Provides a simple UI flow for:
- register
- login
- hotel/room browsing
- availability check
- booking creation
- payment submission
- Calls the Gateway at `http://localhost:4000`

### Gateway (`gateway/`)

- Single entry point for client requests
- Proxies requests to Auth, Booking, and Payment services
- Handles CORS for local frontend origins

### Auth Service (`services/auth-service/`)

- Register user
- Login user
- JWT generation
- Authenticated profile (`/me`)

### Booking Service (`services/booking-service/`)

- List hotels
- List rooms by hotel
- Check room availability
- Create booking
- Get booking by ID
- Internal status update endpoints for Payment orchestration

### Payment Service (`services/payment-service/`)

- Validate booking for payment
- Create payment record
- Simulate payment result
- Update booking status via Booking internal endpoint

### Notification Service (`services/notification-service/`)

- Consumes RabbitMQ events:
- `booking.*`
- `payment.*`
- Keeps a simple in-memory notification log endpoint

## 4. API Base URLs and Ports

- Frontend: `http://localhost:3001`
- Gateway: `http://localhost:4000`
- Auth: `http://localhost:4001`
- Booking: `http://localhost:4002`
- Payment: `http://localhost:4003`
- Notification: `http://localhost:4004`
- PostgreSQL: `localhost:5432`
- RabbitMQ: `localhost:5672`
- RabbitMQ Management: `http://localhost:15672`

## 5. How To Run the Full System

From repository root:

```powershell
docker compose up --build -d
```

Check status:

```powershell
docker compose ps
```

If your terminal does not recognize `docker`, use:

```powershell
& "C:\Program Files\Docker\Docker\resources\bin\docker.exe" compose ps
```

## 6. Frontend Usage Flow

Open `http://localhost:3001` and follow:

1. Register
2. Login
3. Load hotels
4. Load rooms
5. Check availability
6. Create booking
7. Submit payment

Notes:

- Use CVV `123` (or any non-`000`) for success path.
- Use CVV `000` to simulate payment failure.

## 7. Database and PgAdmin Guide

### PostgreSQL container credentials

- Host: `localhost`
- Port: `5432`
- Database: `securestay`
- Username: `securestay`
- Password: `securestay`

### Register server in PgAdmin

1. Right-click `Servers` -> `Register` -> `Server...`
2. General tab:
- Name: `SecureStay Local`
3. Connection tab:
- Host: `localhost`
- Port: `5432`
- Maintenance DB: `securestay`
- Username: `securestay`
- Password: `securestay`
4. Save.

### View tables in PgAdmin

Expand:

`Servers -> SecureStay Local -> Databases -> securestay -> Schemas -> public -> Tables`

Expected tables:

- `users`
- `hotels`
- `rooms`
- `bookings`
- `payments`

### Important clarification

`http://localhost:5432/` in a browser does not show DB data because PostgreSQL is not an HTTP service.

### CLI verification (source of truth)

```powershell
& "C:\Program Files\Docker\Docker\resources\bin\docker.exe" compose exec postgres psql -U securestay -d securestay -c "\dt"
```

## 8. Automated Integration Test

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\integration-smoke.ps1
```

The script validates:

- service health
- register/login/profile
- list hotels/rooms
- availability
- booking creation
- payment success path
- booking confirm after success
- payment failure path
- booking failed after failure
- notification event consumption

## 9. Event and Messaging Flow

- Booking created -> `booking.created`
- Booking status updates -> `booking.status.updated`
- Payment processed -> `payment.processed`
- Notification Service consumes `booking.*` and `payment.*`

## 10. Known Implementation Notes

- Payment gateway is simulated.
- CVV `000` forces failed payment.
- Other CVV values produce success.
- Notification logs are in-memory (non-persistent).

## 11. Troubleshooting Quick Reference

### A) `docker` command not found

Use full path:

```powershell
& "C:\Program Files\Docker\Docker\resources\bin\docker.exe" compose ps
```

Then add Docker path to system/user PATH and restart terminal.

### B) PgAdmin shows no tables

Check CLI first:

```powershell
& "C:\Program Files\Docker\Docker\resources\bin\docker.exe" compose exec postgres psql -U securestay -d securestay -c "\dt"
```

If tables exist in CLI, PgAdmin is connected to wrong DB context or stale browser tree. Reconnect and refresh `securestay` database tree.

### C) Frontend not opening on `3000`

This project uses `3001` for frontend intentionally to avoid common local port conflicts.

### D) Stale/old containers conflict

```powershell
docker compose down --remove-orphans
docker compose up --build -d
```

### E) Full reset (deletes current DB data)

```powershell
docker compose down -v
docker compose up --build -d
```

## 12. GitHub Publishing Checklist

If repository is not initialized yet:

1. `git init`
2. `git add .`
3. `git commit -m "Initial SecureStay implementation"`
4. Create repo in GitHub
5. `git remote add origin <repo-url>`
6. `git branch -M main`
7. `git push -u origin main`

## 13. Recommended Next Steps

1. Add persistent notification storage (table + query endpoints).
2. Add OpenAPI-based request validation middleware.
3. Add role-based auth checks for admin operations.
4. Add CI workflow for smoke tests on PRs.
5. Add frontend route-level UX improvements and booking history page.
