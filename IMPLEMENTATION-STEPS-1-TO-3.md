# SecureStay Implementation Steps 1-3

## Step 1 – Finalize scope and architecture

**Status:** Complete (see `docs/step01-scope-and-architecture.md`)

**Key Decisions:**
- MVP: Register/login, browse rooms, book, pay, notify
- Services: Auth (users), Booking (hotels/rooms/bookings), Payment (payments), Notification (logs), Gateway (routing)
- Stack: Node.js/Express, PostgreSQL, RabbitMQ, Docker, JWT/BCrypt
- Flow: Client → Gateway → Services; Events via RabbitMQ

**Verify:**
```bash
cat docs/step01-scope-and-architecture.md
ls contracts/  # auth-service.yaml etc.
```

**Team Alignment:** Freeze features/services/DB ownership before parallel work.

## Step 2 – Prepare repositories and project structure

**Status:** Complete (current repo)

**Structure:**
```
.
├── frontend/
├── gateway/
├── services/
│   ├── auth-service/
│   ├── booking-service/
│   ├── payment-service/
│   └── notification-service/
├── database/schema.sql
├── contracts/*.yaml
├── k8s/*.yaml
└── docker-compose.yml
```

**Branching:** main/develop, feature branches
**Standards:** ESLint, commitlint, .gitignore present

**Verify:**
```bash
tree .  # or ls -R
git status
```

**Push your fork:** `git remote add upstream https://github.com/nimeshayasith/SecureStay.git`

## Step 3 – Design database and contracts

**Status:** Complete (see `docs/step03-database-and-contracts.md`)

**Database:** PostgreSQL `database/schema.sql` (users, hotels, rooms, bookings, payments)
```bash
head -50 database/schema.sql  # UUID PKs, constraints
```

**APIs:** OpenAPI YAML
```bash
cat contracts/booking-service.yaml  # Endpoints: GET /hotels, POST /bookings
```

**Events:** RabbitMQ `contracts/events.md`
- `booking.created`, `booking.status.updated`
- `payment.processed`

**Verify DB on run:**
```bash
docker compose up -d postgres rabbitmq
docker compose exec postgres psql -U securestay -d securestay -c "\\dt"
```

**Next:** Proceed to Step 4 (services impl, already scaffolded).

