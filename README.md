# SecureStay

SecureStay is a cloud-native hotel booking system designed to demonstrate core cloud computing principles such as scalability, high availability, security, containerized deployment, and automated delivery.

This repository currently contains:

- Step 01: scope and architecture
- Step 03: PostgreSQL schema and service contracts
- Step 04: implementation scaffold for gateway, microservices, and frontend

## Implementation structure

- `frontend/`
- `gateway/`
- `services/auth-service/`
- `services/booking-service/`
- `services/payment-service/`
- `services/notification-service/`
- `database/`
- `contracts/`
- `docs/`

## Quick start

```bash
docker compose up --build
```

Gateway: `http://localhost:4000`  
Frontend: `http://localhost:3001`

