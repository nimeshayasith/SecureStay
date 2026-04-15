# SecureStay Event Contracts

This file defines the minimum RabbitMQ event contract for the Step 03 MVP.

## Broker assumptions

- Exchange name: `securestay.events`
- Exchange type: `topic`
- Publisher services: Booking Service, Payment Service
- Consumer service: Notification Service

## Event naming

- `booking.created`
- `booking.confirmed`
- `payment.completed`
- `payment.failed`

## Shared envelope

Each event should follow a consistent envelope:

```json
{
  "eventId": "uuid",
  "eventType": "booking.created",
  "occurredAt": "2026-04-04T02:50:00Z",
  "source": "booking-service",
  "payload": {}
}
```

## booking.created

Published when a booking record is created in `PENDING` status.

```json
{
  "eventId": "uuid",
  "eventType": "booking.created",
  "occurredAt": "2026-04-04T02:50:00Z",
  "source": "booking-service",
  "payload": {
    "bookingId": "uuid",
    "userId": "uuid",
    "roomId": "uuid",
    "checkInDate": "2026-04-10",
    "checkOutDate": "2026-04-12",
    "status": "PENDING"
  }
}
```

## booking.confirmed

Published when the booking status is updated to `CONFIRMED` after a successful payment.

```json
{
  "eventId": "uuid",
  "eventType": "booking.confirmed",
  "occurredAt": "2026-04-04T02:55:00Z",
  "source": "booking-service",
  "payload": {
    "bookingId": "uuid",
    "userId": "uuid",
    "roomId": "uuid",
    "status": "CONFIRMED"
  }
}
```

## payment.completed

Published when a payment is processed successfully.

```json
{
  "eventId": "uuid",
  "eventType": "payment.completed",
  "occurredAt": "2026-04-04T02:56:00Z",
  "source": "payment-service",
  "payload": {
    "paymentId": "uuid",
    "bookingId": "uuid",
    "transactionReference": "TXN-10001",
    "amount": 120.00,
    "currency": "USD",
    "status": "SUCCESS"
  }
}
```

## payment.failed

Published when a payment attempt fails and the booking should remain unconfirmed.

```json
{
  "eventId": "uuid",
  "eventType": "payment.failed",
  "occurredAt": "2026-04-04T02:56:00Z",
  "source": "payment-service",
  "payload": {
    "paymentId": "uuid",
    "bookingId": "uuid",
    "transactionReference": "TXN-10002",
    "amount": 120.00,
    "currency": "USD",
    "status": "FAILED",
    "reason": "Card declined"
  }
}
```

## Integration notes

- The API Gateway does not publish events.
- Auth Service is synchronous only for the MVP.
- Notification Service should subscribe to both booking and payment outcomes.
- Raw card numbers and CVV values must never be included in messages.
