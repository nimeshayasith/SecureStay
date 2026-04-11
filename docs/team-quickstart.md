# SecureStay Team Quick Start

Use this file first. It is the shortest path to run and verify the project.

## 1. Prerequisites

- Docker Desktop installed and running
- PowerShell terminal

If `docker` command is not recognized, use:

```powershell
& "C:\Program Files\Docker\Docker\resources\bin\docker.exe" compose ps
```

## 2. Start the project

From project root:

```powershell
docker compose up --build -d
```

If `docker` is not recognized:

```powershell
& "C:\Program Files\Docker\Docker\resources\bin\docker.exe" compose up --build -d
```

## 3. Confirm services are running

```powershell
docker compose ps
```

You should see:

- gateway
- frontend
- auth-service
- booking-service
- payment-service
- notification-service
- postgres (healthy)
- rabbitmq (healthy)

## 4. Open apps

- Frontend: `http://localhost:3001`
- Gateway: `http://localhost:4000/health`
- RabbitMQ UI: `http://localhost:15672`

## 5. Basic user flow in frontend

1. Register a user
2. Login
3. Load hotels
4. Load rooms
5. Check availability
6. Create booking
7. Submit payment

Payment rule:

- CVV `000` -> failed payment
- Any other CVV -> success payment

## 6. Check database in PgAdmin

Create connection with:

- Host: `localhost`
- Port: `5432`
- Database: `securestay`
- Username: `securestay`
- Password: `securestay`

Tables expected:

- users
- hotels
- rooms
- bookings
- payments

If PgAdmin does not show tables, verify from terminal:

```powershell
& "C:\Program Files\Docker\Docker\resources\bin\docker.exe" compose exec postgres psql -U securestay -d securestay -c "\dt"
```

If terminal shows tables, DB is fine and PgAdmin is connected to wrong DB context.

## 7. Run automated smoke test

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\integration-smoke.ps1
```

This validates full flow end-to-end.

## 8. Common fixes

### Docker command not found

- Restart terminal
- Use full docker path command shown above

### Containers conflict or stale state

```powershell
docker compose down --remove-orphans
docker compose up --build -d
```

### Clean reset (deletes DB data)

```powershell
docker compose down -v
docker compose up --build -d
```

## 9. Where to read next

- Full implementation guide: `docs/team-implementation-guide.md`
- Step details: `docs/step01...`, `docs/step03...`, `docs/step04...`
