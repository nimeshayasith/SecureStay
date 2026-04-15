# SecureStay

A cloud-native hotel booking system demonstrating core cloud computing principles including scalability, high availability, security, containerized deployment, and asynchronous communication.

## Architecture

SecureStay uses a microservices architecture with the following components:

| Service | Port | Responsibility |
|---|---|---|
| API Gateway | 4000 | Single entry point, request routing, JWT validation |
| Auth Service | 4001 | Registration, login, JWT token issuance, RBAC |
| Booking Service | 4002 | Hotel search, room availability, reservations |
| Payment Service | 4003 | Payment processing, masked card storage |
| Notification Service | 4004 | RabbitMQ event consumer, notification logs |
| PostgreSQL | 5432 | Users, hotels, rooms, bookings, payments |
| RabbitMQ | 5672 | Async event messaging between services |
| MongoDB | 27017 | Notification log persistence |

## Prerequisites

- Node.js v18+
- Docker and Docker Compose
- Minikube (for Kubernetes)
- kubectl

---

## Stage 1 — Local Run

### Step 1: Start infrastructure
```bash
cd SecureStay
docker-compose up -d postgres rabbitmq mongodb
```
Wait until postgres, rabbitmq, and mongodb are healthy.

### Step 2: Install dependencies for all services
```bash
cd services/auth-service && npm install && cd ../..
cd services/booking-service && npm install && cd ../..
cd services/payment-service && npm install && cd ../..
cd services/notification-service && npm install && cd ../..
cd gateway && npm install && cd ..
```

### Step 3: Start each service in a separate terminal
```bash
# Terminal 1
cd services/auth-service && npm start

# Terminal 2
cd services/booking-service && npm start

# Terminal 3
cd services/payment-service && npm start

# Terminal 4
cd services/notification-service && npm start

# Terminal 5
cd gateway && npm start
```

### Step 4: Verify all services are running
```bash
curl http://localhost:4000/health
curl http://localhost:4001/health
curl http://localhost:4002/health
curl http://localhost:4003/health
curl http://localhost:4004/health
```

---

## Stage 2 — Docker

### Step 1: Start everything
```bash
cd SecureStay
docker-compose up --build
```

### Step 2: Verify
```bash
curl http://localhost:4000/health
```

### Step 3: Stop
```bash
docker-compose down
```

---

## Stage 3 — Kubernetes

### Step 1: Start Minikube
```bash
minikube start
```

### Step 2: Build and load images
```bash
docker build -t lasindu123/auth-service:1.0 ./services/auth-service
docker build -t lasindu123/booking-service:1.0 ./services/booking-service
docker build -t lasindu123/payment-service:1.0 ./services/payment-service
docker build -t lasindu123/notification-service:1.0 ./services/notification-service
docker build -t lasindu123/gateway:1.1 ./gateway
docker build -t lasindu123/frontend:1.0 ./frontend

minikube image load lasindu123/auth-service:1.0
minikube image load lasindu123/booking-service:1.0
minikube image load lasindu123/payment-service:1.0
minikube image load lasindu123/notification-service:1.0
minikube image load lasindu123/gateway:1.1
minikube image load lasindu123/frontend:1.0
```

### Step 3: Apply manifests in order
```bash
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/rabbitmq.yaml
kubectl apply -f k8s/mongodb.yaml
kubectl apply -f k8s/auth.yaml
kubectl apply -f k8s/booking.yaml
kubectl apply -f k8s/payment.yaml
kubectl apply -f k8s/notification.yaml
kubectl apply -f k8s/gateway.yaml
```

### Step 4: Wait for all pods to be running
```bash
kubectl get pods
```

### Step 5: Get gateway URL
```bash
minikube service gateway --url
```

Use the returned URL instead of `http://localhost:4000` for all requests.

---

## API Flow — Full Test

### 1. Register
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test User","email":"test@test.com","password":"password123"}'
```

### 2. Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'
```
Copy the `accessToken` from the response.

### 3. Search hotels
```bash
curl http://localhost:4000/api/bookings/hotels
```

### 4. Get rooms (replace HOTEL_ID)
```bash
curl "http://localhost:4000/api/bookings/rooms?hotelId=HOTEL_ID"
```

### 5. Create booking (replace TOKEN and ROOM_ID)
```bash
curl -X POST http://localhost:4000/api/bookings/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"roomId":"ROOM_ID","checkInDate":"2026-08-01","checkOutDate":"2026-08-03","guestCount":2}'
```

### 6. Process payment (replace TOKEN, BOOKING_ID, AMOUNT)
```bash
curl -X POST http://localhost:4000/api/payments/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"bookingId":"BOOKING_ID","amount":AMOUNT,"paymentMethod":"CARD","cardNumber":"4111111111111111","cardHolderName":"Test User","expiryMonth":"12","expiryYear":"2027","cvv":"123"}'
```
Use cvv `000` to simulate a failed payment.

### 7. Check notifications
```bash
curl http://localhost:4000/api/notifications
```

---

## Security Features

- JWT-based authentication with 1 hour expiry
- Role-based access control (CUSTOMER / ADMIN)
- Passwords hashed with bcrypt (10 rounds)
- Card numbers masked — only last 4 digits stored
- Raw card data never persisted
- Secrets managed via environment variables and Kubernetes Secrets
- Protected routes return 401 for missing or invalid tokens

## Communication Methods

- **Synchronous (REST)** — client to gateway, gateway to services, payment to booking (internal)
- **Asynchronous (RabbitMQ)** — booking and payment publish events, notification service consumes them via topic exchange

## Database Schema

See `database/schema.sql` for the full PostgreSQL schema including users, hotels, rooms, bookings, and payments tables with constraints and indexes.

## Environment Variables

Each service reads from its own `.env` file for local development and from Kubernetes Secrets for cluster deployment. See `k8s/secrets.yaml` for the Kubernetes configuration.

| Variable | Used by |
|---|---|
| DATABASE_URL | auth, booking, payment |
| JWT_SECRET | auth, booking, payment |
| RABBITMQ_URL | booking, payment, notification |
| MONGODB_URL | notification |
| BOOKING_SERVICE_INTERNAL_URL | payment |
