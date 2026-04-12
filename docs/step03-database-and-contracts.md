# Step 03: Database and Contracts

Step 03 defines the shared implementation contract for the SecureStay MVP. The goal is to give every service owner a clear data model, API boundary, and event format before coding begins.

## Deliverables

- PostgreSQL schema for users, hotels, rooms, bookings, and payments
- OpenAPI contract files for Auth, Booking, and Payment services
- RabbitMQ event contract for booking and payment workflows

## File map

- `database/schema.sql`
- `contracts/auth-service.yaml`
- `contracts/booking-service.yaml`
- `contracts/payment-service.yaml`
- `contracts/events.md`

## Design notes

- The schema uses UUID primary keys for service-friendly identifiers.
- Booking and payment status values are restricted with database constraints.
- Payment records store only masked card values and transaction references.
- Notification behavior is driven by RabbitMQ events instead of direct service coupling.

## Ready-for-build outcomes

After Step 03, the team can:

- implement service models with a shared relational baseline
- build controllers and request validation from the API contracts
- connect RabbitMQ publishers and consumers with agreed event names
- begin Step 04 service implementation in parallel
