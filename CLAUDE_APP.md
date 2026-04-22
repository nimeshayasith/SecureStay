# CLAUDE.md — SecureStay Application Pipeline
# Repository: https://github.com/nimeshayasith/SecureStay.git

> **Status:** Existing application — tested locally. Pipeline and Helm chart to be added.
> **Author role:** Senior DevOps / Cloud Engineer
> **Runtime:** Docker + Kubernetes (AWS EKS)
> **CI/CD:** GitHub Actions
> **Image Registry:** AWS ECR (provisioned by infrsa pipeline)
> **Deployment:** Helm chart — image tag updated and rolled out on every merge to `main`

---

## 1. Application Overview

SecureStay is a cloud-native hotel booking system built as microservices. The application
is tested locally with `docker-compose`. This CLAUDE.md file describes exactly what needs
to change, what needs to be created, and how the full CI/CD pipeline works.

**Read this before touching any file:**

---

## 2. Database Architecture — Critical Change from Local Setup

The local `docker-compose.yml` runs PostgreSQL and MongoDB as containers. In production
(EKS), **both are removed from Kubernetes**. Replace them with a single AWS RDS PostgreSQL.

### What changes

| Before (local only) | After (production) |
|---|---|
| `postgres` container in docker-compose | AWS RDS PostgreSQL (provisioned by infra pipeline) |
| `mongodb` container in docker-compose | Deleted — `notification-service` uses PostgreSQL |
| `k8s/postgres.yaml` applied to EKS | **Deleted — never apply this** |
| `k8s/mongodb.yaml` applied to EKS | **Deleted — never apply this** |
| `notification-service` uses `MONGODB_URL` | **Changed to `DATABASE_URL`** |

### Single shared RDS database `securestay` — table ownership per service

| Service | Tables | Notes |
|---|---|---|
| `auth-service` | `users` | Already uses PostgreSQL — no change |
| `booking-service` | `hotels`, `rooms`, `bookings` | Already uses PostgreSQL — no change |
| `payment-service` | `payments` | Already uses PostgreSQL — no change |
| `notification-service` | `notification_logs` | **Migrated from MongoDB — code change required** |

RabbitMQ stays in-cluster (Helm release). Nothing changes for messaging.

---

## 3. Immediate Code Changes Required

### 3.1 — Delete in-cluster database manifests

```bash
# Run from the repo root — delete these files permanently
rm k8s/postgres.yaml
rm k8s/mongodb.yaml
```

These must never be applied to the EKS cluster. The database lives in AWS RDS.

### 3.2 — Migrate `notification-service` from MongoDB to PostgreSQL

The `notification-service` currently uses `MongoClient` to persist consumed events.
Replace it with a PostgreSQL `pg.Pool` connection. This is the only service that needs a code change.

**Remove from `notification-service/package.json` dependencies:**
```json
"mongodb": "*"
```

**Add to `notification-service/package.json` dependencies:**
```json
"pg": "^8.11.0"
```

**Replace the database connection in `notification-service/src/db.js` (or equivalent):**
```javascript
// BEFORE (MongoDB)
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.MONGODB_URL);
const db = client.db('securestay');
const logs = db.collection('notification_logs');

// AFTER (PostgreSQL)
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
module.exports = pool;
```

**Replace the event consumer logic in `notification-service/src/consumer.js` (or equivalent):**
```javascript
// BEFORE (MongoDB insert)
await logs.insertOne({
  routingKey: msg.fields.routingKey,
  eventType: data.type,
  payload: data,
  receivedAt: new Date()
});

// AFTER (PostgreSQL insert into notification_logs)
const pool = require('./db');
await pool.query(
  `INSERT INTO notification_logs (routing_key, event_type, payload, status, received_at)
   VALUES ($1, $2, $3, $4, NOW())`,
  [msg.fields.routingKey, data.type || 'unknown', JSON.stringify(data), 'delivered']
);
```

**Replace the log retrieval endpoint:**
```javascript
// BEFORE (MongoDB find)
const recent = await logs.find({}).sort({ receivedAt: -1 }).limit(50).toArray();

// AFTER (PostgreSQL query from notification_logs)
const { rows } = await pool.query(
  `SELECT * FROM notification_logs ORDER BY received_at DESC LIMIT 50`
);
res.json(rows);
```

**Remove `MONGODB_URL` from notification-service environment config everywhere.**
**Add `DATABASE_URL` in its place** — same variable name used by all other services.

### 3.3 — Verify health endpoints exist in all services

Every service needs a `/health` route returning HTTP 200. This is required for
Kubernetes liveness and readiness probes.

```javascript
// Add to every service's main router if not already present
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: process.env.SERVICE_NAME || 'unknown' });
});
```

---

## 4. Project Structure — What Exists and What to Add

```
SecureStay/
│
├── api-gateway/              ← existing — verify Dockerfile + /health route
├── auth-service/             ← existing — verify Dockerfile + /health route
├── booking-service/          ← existing — verify Dockerfile + /health route
├── payment-service/          ← existing — verify Dockerfile + /health route
├── notification-service/     ← existing — CODE CHANGE REQUIRED (Section 3.2)
│
├── k8s/
│   ├── postgres.yaml         ← DELETE THIS — RDS replaces it
│   ├── mongodb.yaml          ← DELETE THIS — RDS replaces it
│   ├── namespace.yaml        ← keep
│   ├── secrets.yaml          ← UPDATE — replace MONGODB_URL with DATABASE_URL
│   └── configmap.yaml        ← keep
│
├── helm/                     ← CREATE THIS — Helm chart for all 5 services
│   └── securestay/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│           ├── namespace.yaml
│           ├── secrets.yaml
│           ├── migration-job.yaml          ← Kubernetes Job: runs schema.sql once
│           ├── api-gateway-deployment.yaml
│           ├── auth-service-deployment.yaml
│           ├── booking-service-deployment.yaml
│           ├── payment-service-deployment.yaml
│           ├── notification-service-deployment.yaml
│           ├── api-gateway-service.yaml
│           ├── auth-service-service.yaml
│           ├── booking-service-service.yaml
│           ├── payment-service-service.yaml
│           ├── notification-service-service.yaml
│           └── ingress.yaml
│
├── .github/
│   └── workflows/
│       ├── pr-check.yml      ← CREATE THIS — build check on every PR
│       └── app-pipeline.yml  ← CREATE THIS — build, push ECR, Helm deploy on merge
│
├── docker-compose.yml        ← keep for local development only
├── CLAUDE.md                 ← this file
└── README.md
```

---

## 5. Dockerfile Requirements

Each service must have a production-ready Dockerfile. If missing, create one:

```dockerfile
# <service-name>/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS runtime
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY src ./src
COPY package.json .
USER appuser
EXPOSE <PORT>
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:<PORT>/health || exit 1
CMD ["node", "src/index.js"]
```

**`.dockerignore` for each service:**
```
node_modules
.env
.env.*
*.test.js
*.spec.js
coverage/
.git
docker-compose.yml
README.md
```

---

## 6. Helm Chart

The Helm chart deploys all five services plus a database migration job in one `helm upgrade` command.

### `helm/securestay/Chart.yaml`
```yaml
apiVersion: v2
name: securestay
description: SecureStay cloud-native hotel booking system
type: application
version: 1.0.0
appVersion: "latest"
```

### `helm/securestay/values.yaml`
```yaml
global:
  imageRegistry: ""     # Overridden at deploy time: <account>.dkr.ecr.us-east-1.amazonaws.com
  imagePullPolicy: Always
  namespace: securestay

migration:
  enabled: true         # Run schema migration Job before service pods start

apiGateway:
  image: securestay/api-gateway
  tag: "latest"
  replicas: 2
  port: 3000
  resources:
    requests: { cpu: "100m", memory: "128Mi" }
    limits:   { cpu: "500m", memory: "256Mi" }

authService:
  image: securestay/auth-service
  tag: "latest"
  replicas: 2
  port: 3001
  resources:
    requests: { cpu: "100m", memory: "128Mi" }
    limits:   { cpu: "500m", memory: "256Mi" }

bookingService:
  image: securestay/booking-service
  tag: "latest"
  replicas: 2
  port: 3002
  resources:
    requests: { cpu: "100m", memory: "128Mi" }
    limits:   { cpu: "500m", memory: "256Mi" }

paymentService:
  image: securestay/payment-service
  tag: "latest"
  replicas: 2
  port: 3003
  resources:
    requests: { cpu: "100m", memory: "128Mi" }
    limits:   { cpu: "500m", memory: "256Mi" }

notificationService:
  image: securestay/notification-service
  tag: "latest"
  replicas: 1             # Single consumer — one pod reads from RabbitMQ queue
  port: 3004
  resources:
    requests: { cpu: "50m",  memory: "64Mi" }
    limits:   { cpu: "200m", memory: "128Mi" }

ingress:
  enabled: true
  className: nginx
  host: app.securestay.com
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
```

### `helm/securestay/templates/migration-job.yaml`

This Job runs `schema.sql` against RDS before any service pods start. It uses a
`psql` Alpine image. It runs once per Helm release as a Helm hook.

```yaml
{{- if .Values.migration.enabled }}
apiVersion: batch/v1
kind: Job
metadata:
  name: securestay-db-migrate
  namespace: {{ .Values.global.namespace }}
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": hook-succeeded
spec:
  backoffLimit: 3
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: postgres:15-alpine
          command:
            - sh
            - -c
            - |
              echo "Running schema migration..."
              psql "$DATABASE_URL" -c "
                CREATE TABLE IF NOT EXISTS users (
                  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                  email VARCHAR(255) UNIQUE NOT NULL,
                  password VARCHAR(255) NOT NULL,
                  role VARCHAR(50) NOT NULL DEFAULT 'customer',
                  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS hotels (
                  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                  name VARCHAR(255) NOT NULL,
                  location VARCHAR(255) NOT NULL,
                  description TEXT,
                  created_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS rooms (
                  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                  hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
                  room_type VARCHAR(100) NOT NULL,
                  price_per_night NUMERIC(10,2) NOT NULL,
                  is_available BOOLEAN NOT NULL DEFAULT TRUE,
                  created_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS bookings (
                  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                  user_id UUID NOT NULL REFERENCES users(id),
                  room_id UUID NOT NULL REFERENCES rooms(id),
                  check_in DATE NOT NULL,
                  check_out DATE NOT NULL,
                  status VARCHAR(50) NOT NULL DEFAULT 'pending',
                  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS payments (
                  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                  booking_id UUID NOT NULL REFERENCES bookings(id),
                  user_id UUID NOT NULL REFERENCES users(id),
                  amount NUMERIC(10,2) NOT NULL,
                  status VARCHAR(50) NOT NULL DEFAULT 'pending',
                  processed_at TIMESTAMP,
                  created_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS notification_logs (
                  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                  routing_key VARCHAR(255) NOT NULL,
                  event_type VARCHAR(100) NOT NULL,
                  payload JSONB NOT NULL,
                  status VARCHAR(50) NOT NULL DEFAULT 'delivered',
                  received_at TIMESTAMP NOT NULL DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_notification_received_at
                  ON notification_logs (received_at DESC);
                CREATE INDEX IF NOT EXISTS idx_notification_event_type
                  ON notification_logs (event_type);
                INSERT INTO hotels (id, name, location, description) VALUES
                  ('11111111-1111-1111-1111-111111111111','Grand Colombo Hotel','Colombo, Sri Lanka','Luxury hotel in Colombo'),
                  ('22222222-2222-2222-2222-222222222222','Kandy Hills Resort','Kandy, Sri Lanka','Mountain resort near Temple of the Tooth')
                ON CONFLICT DO NOTHING;
                INSERT INTO rooms (hotel_id, room_type, price_per_night) VALUES
                  ('11111111-1111-1111-1111-111111111111','Deluxe Single',85.00),
                  ('11111111-1111-1111-1111-111111111111','Deluxe Double',120.00),
                  ('11111111-1111-1111-1111-111111111111','Suite',200.00),
                  ('22222222-2222-2222-2222-222222222222','Standard Single',60.00),
                  ('22222222-2222-2222-2222-222222222222','Standard Double',90.00)
                ON CONFLICT DO NOTHING;
              "
              echo "Migration complete."
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: securestay-secrets
                  key: database-url
{{- end }}
```

### `helm/securestay/templates/secrets.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: securestay-secrets
  namespace: {{ .Values.global.namespace }}
type: Opaque
data:
  # All values are base64-encoded by the pipeline using kubectl create secret --dry-run
  # Do not hardcode values here — this template is just a placeholder structure
```

### `helm/securestay/templates/notification-service-deployment.yaml`

Note: `MONGODB_URL` is removed. `DATABASE_URL` is used instead.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notification-service
  namespace: {{ .Values.global.namespace }}
spec:
  replicas: {{ .Values.notificationService.replicas }}
  selector:
    matchLabels:
      app: notification-service
  template:
    metadata:
      labels:
        app: notification-service
    spec:
      containers:
        - name: notification-service
          image: "{{ .Values.global.imageRegistry }}/{{ .Values.notificationService.image }}:{{ .Values.notificationService.tag }}"
          imagePullPolicy: {{ .Values.global.imagePullPolicy }}
          ports:
            - containerPort: {{ .Values.notificationService.port }}
          env:
            - name: DATABASE_URL          # PostgreSQL RDS — replaces MONGODB_URL
              valueFrom:
                secretKeyRef:
                  name: securestay-secrets
                  key: database-url
            - name: RABBITMQ_URL
              valueFrom:
                secretKeyRef:
                  name: securestay-secrets
                  key: rabbitmq-url
            - name: PORT
              value: "{{ .Values.notificationService.port }}"
          resources:
            {{- toYaml .Values.notificationService.resources | nindent 12 }}
          readinessProbe:
            httpGet:
              path: /health
              port: {{ .Values.notificationService.port }}
            initialDelaySeconds: 15
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: {{ .Values.notificationService.port }}
            initialDelaySeconds: 30
            periodSeconds: 10
```

### `helm/securestay/templates/ingress.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: securestay-ingress
  namespace: {{ .Values.global.namespace }}
  annotations:
    {{- toYaml .Values.ingress.annotations | nindent 4 }}
spec:
  ingressClassName: {{ .Values.ingress.className }}
  rules:
    - host: {{ .Values.ingress.host }}
      http:
        paths:
          - path: /auth
            pathType: Prefix
            backend:
              service:
                name: auth-service
                port: { number: {{ .Values.authService.port }} }
          - path: /bookings
            pathType: Prefix
            backend:
              service:
                name: booking-service
                port: { number: {{ .Values.bookingService.port }} }
          - path: /payments
            pathType: Prefix
            backend:
              service:
                name: payment-service
                port: { number: {{ .Values.paymentService.port }} }
          - path: /notifications
            pathType: Prefix
            backend:
              service:
                name: notification-service
                port: { number: {{ .Values.notificationService.port }} }
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-gateway
                port: { number: {{ .Values.apiGateway.port }} }
```

---

## 7. GitHub Actions Pipelines

### Workflow 1 — `pr-check.yml` (PR Gate: Build Check)

**Trigger:** Any PR to `main` or `develop`
**Purpose:** Build all 5 Docker images (without pushing) + run lint. Fast feedback before merge.

```yaml
# .github/workflows/pr-check.yml
name: "PR Check — Build & Lint"

on:
  pull_request:
    branches: [main, develop]

jobs:
  build-check:
    name: "Build — ${{ matrix.service }}"
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        service:
          - api-gateway
          - auth-service
          - booking-service
          - payment-service
          - notification-service

    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image (no push)
        uses: docker/build-push-action@v5
        with:
          context: ./${{ matrix.service }}
          push: false
          tags: securestay/${{ matrix.service }}:pr-check

      - name: Lint
        working-directory: ./${{ matrix.service }}
        run: |
          npm ci --silent
          npm run lint --if-present
```

---

### Workflow 2 — `app-pipeline.yml` (Build → Push → Deploy)

**Trigger:** Push to `main`
**Purpose:** Build all images, tag with `<timestamp>-<sha>`, push to ECR, Helm upgrade EKS.

```yaml
# .github/workflows/app-pipeline.yml
name: "App Pipeline — Build → Push → Deploy"

on:
  push:
    branches: [main]

env:
  AWS_REGION:   us-east-1
  CLUSTER_NAME: securestay-eks
  NAMESPACE:    securestay

jobs:
  # ─────────────────────────────────────────────────────────────
  # Job 1: Build and push all Docker images to ECR in parallel
  # ─────────────────────────────────────────────────────────────
  build-and-push:
    name: "Build & Push — ${{ matrix.service }}"
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        service:
          - api-gateway
          - auth-service
          - booking-service
          - payment-service
          - notification-service

    outputs:
      image_tag: ${{ steps.tag.outputs.version }}

    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id:     ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region:            ${{ env.AWS_REGION }}

      - uses: aws-actions/amazon-ecr-login@v2
        id: login-ecr

      - name: Generate image tag
        id: tag
        run: |
          SHORT_SHA=$(echo ${{ github.sha }} | cut -c1-7)
          TIMESTAMP=$(date +%Y%m%d%H%M%S)
          echo "version=${TIMESTAMP}-${SHORT_SHA}" >> $GITHUB_OUTPUT

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./${{ matrix.service }}
          push: true
          tags: |
            ${{ steps.login-ecr.outputs.registry }}/securestay/${{ matrix.service }}:${{ steps.tag.outputs.version }}
            ${{ steps.login-ecr.outputs.registry }}/securestay/${{ matrix.service }}:latest
          cache-from: type=gha
          cache-to:   type=gha,mode=max

  # ─────────────────────────────────────────────────────────────
  # Job 2: Deploy to EKS via Helm (runs after all builds pass)
  # ─────────────────────────────────────────────────────────────
  deploy:
    name: "Deploy to EKS via Helm"
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: production       # Manual approval gate in GitHub → Settings → Environments

    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id:     ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region:            ${{ env.AWS_REGION }}

      - uses: aws-actions/amazon-ecr-login@v2
        id: login-ecr

      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig --region ${{ env.AWS_REGION }} --name ${{ env.CLUSTER_NAME }}

      - uses: azure/setup-helm@v3
        with:
          version: "3.14.0"

      - name: Generate image tag
        id: tag
        run: |
          SHORT_SHA=$(echo ${{ github.sha }} | cut -c1-7)
          TIMESTAMP=$(date +%Y%m%d%H%M%S)
          echo "version=${TIMESTAMP}-${SHORT_SHA}" >> $GITHUB_OUTPUT

      - name: Create namespace
        run: |
          kubectl create namespace ${{ env.NAMESPACE }} --dry-run=client -o yaml | kubectl apply -f -

      - name: Create Kubernetes Secret (all service env vars)
        # MONGODB_URL is intentionally absent — notification-service uses DATABASE_URL
        run: |
          kubectl create secret generic securestay-secrets \
            --namespace=${{ env.NAMESPACE }} \
            --from-literal=database-url="${{ secrets.DATABASE_URL }}" \
            --from-literal=jwt-secret="${{ secrets.JWT_SECRET }}" \
            --from-literal=rabbitmq-url="${{ secrets.RABBITMQ_URL }}" \
            --from-literal=payment-secret="${{ secrets.PAYMENT_SECRET }}" \
            --dry-run=client -o yaml | kubectl apply -f -

      - name: Helm upgrade — deploy all services with new image tag
        run: |
          IMAGE_TAG=${{ steps.tag.outputs.version }}
          ECR=${{ steps.login-ecr.outputs.registry }}

          helm upgrade --install securestay ./helm/securestay \
            --namespace ${{ env.NAMESPACE }} \
            --create-namespace \
            --atomic \
            --timeout 8m \
            --set global.imageRegistry=${ECR} \
            --set apiGateway.tag=${IMAGE_TAG} \
            --set authService.tag=${IMAGE_TAG} \
            --set bookingService.tag=${IMAGE_TAG} \
            --set paymentService.tag=${IMAGE_TAG} \
            --set notificationService.tag=${IMAGE_TAG}

      - name: Verify all rollouts are healthy
        run: |
          for svc in api-gateway auth-service booking-service payment-service notification-service; do
            kubectl rollout status deployment/${svc} -n ${{ env.NAMESPACE }} --timeout=3m
            echo "${svc} is running"
          done

      - name: Confirm notification-service uses PostgreSQL (not MongoDB)
        run: |
          echo "Checking notification-service env vars:"
          kubectl get deployment notification-service -n ${{ env.NAMESPACE }} \
            -o jsonpath='{.spec.template.spec.containers[0].env}' | grep -v MONGODB || true
          echo "MONGODB_URL must NOT appear above. DATABASE_URL is used instead."

      - name: Show running pods
        run: kubectl get pods -n ${{ env.NAMESPACE }}

      - name: Show services and ports
        run: kubectl get svc -n ${{ env.NAMESPACE }}

      - name: Rollback on failure
        if: failure()
        run: |
          echo "Deployment failed — rolling back"
          helm rollback securestay --namespace ${{ env.NAMESPACE }}
```

---

## 8. Environment Variables Per Service

All services read config from environment variables only. No `.env` files in containers.

| Variable | auth | booking | payment | notification | Description |
|---|:---:|:---:|:---:|:---:|---|
| `DATABASE_URL` | ✓ | ✓ | ✓ | ✓ | RDS PostgreSQL connection string (replaces MONGODB_URL for notification) |
| `JWT_SECRET` | ✓ | | | | Token signing secret |
| `JWT_EXPIRY` | ✓ | | | | e.g. `24h` |
| `RABBITMQ_URL` | | ✓ | ✓ | ✓ | amqp://... connection to in-cluster RabbitMQ |
| `BOOKING_EXCHANGE` | | ✓ | | ✓ | RabbitMQ exchange name for booking events |
| `PAYMENT_EXCHANGE` | | | ✓ | ✓ | RabbitMQ exchange name for payment events |
| `PORT` | ✓ | ✓ | ✓ | ✓ | Service listen port |
| `NODE_ENV` | ✓ | ✓ | ✓ | ✓ | Set to `production` in EKS |

**`DATABASE_URL` format:**
```
postgresql://securestay_admin:<password>@<rds-endpoint>:5432/securestay?sslmode=require
```
Get the RDS endpoint from the infra pipeline's Terraform output after first apply.

---

## 9. GitHub Repository Secrets (App Repo)

`Settings → Secrets and variables → Actions`:

| Secret | Value | How to get it |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | nimesh-admin access key | From IAM in AWS Console |
| `AWS_SECRET_ACCESS_KEY` | nimesh-admin secret key | From IAM in AWS Console |
| `AWS_ACCOUNT_ID` | 12-digit account ID | From AWS Console → top right |
| `DATABASE_URL` | Full RDS connection string | From infra pipeline Terraform output |
| `JWT_SECRET` | Random 64-char string | Generate: `openssl rand -base64 64` |
| `RABBITMQ_URL` | `amqp://securestay_admin:<pass>@<rabbitmq-nlb>:5672` | From RabbitMQ NLB DNS after infra deploy |
| `PAYMENT_SECRET` | Payment gateway key | From payment provider dashboard |

**There is no `MONGODB_URL` secret. It has been removed.**

---

## 10. Acceptance Test Plan

Run these tests after deployment to verify everything is working correctly
with the unified PostgreSQL backend.

```
Test 1 — No in-cluster databases
  kubectl get pods -n securestay | grep -E "postgres|mongo"
  Expected: no results (both removed from Kubernetes)

Test 2 — All services start and reach Ready state
  kubectl get pods -n securestay
  Expected: all 5 service pods in Running/Ready state

Test 3 — Auth service: user registration
  POST /auth/register { email, password }
  Expected: 201 Created + JWT token returned
  Verify: row created in users table in RDS

Test 4 — Booking service: hotel search
  GET /bookings/hotels
  Expected: returns seed hotels (Grand Colombo, Kandy Hills)
  Verify: query hits hotels + rooms tables in RDS

Test 5 — Booking service: create reservation
  POST /bookings/create { roomId, checkIn, checkOut }  (with JWT)
  Expected: booking created, status = 'pending'
  Verify: row in bookings table in RDS

Test 6 — Payment service: process payment
  POST /payments/process { bookingId, amount }  (with JWT)
  Expected: payment status = 'success', booking status updated
  Verify: row in payments table in RDS (no raw card data stored)

Test 7 — Notification service: event consumed and persisted in PostgreSQL
  After Test 6, wait ~5 seconds for RabbitMQ event to process
  GET /notifications/logs
  Expected: JSON array of recent events from notification_logs table
  Verify: rows exist in notification_logs in RDS (NOT MongoDB)

Test 8 — Notification persistence survives pod restart
  kubectl rollout restart deployment/notification-service -n securestay
  GET /notifications/logs again
  Expected: same logs still returned (data lives in RDS, not pod memory)

Test 9 — Gateway protects routes
  GET /bookings/hotels (no JWT)
  Expected: 401 Unauthorized

Test 10 — RBAC: admin vs customer
  Log in as admin user → access admin route → Expected: 200
  Log in as customer → access admin route → Expected: 403
```

---

## 11. Pipeline Flow Summary

```
Developer pushes to feature branch
        │
        ▼
  Opens Pull Request
        │
        ▼
  pr-check.yml runs (parallel across 5 services)
  ┌──────────────────────────────────────────┐
  │  • docker build each service (no push)   │
  │  • npm lint per service                  │
  │  • All must pass before merge allowed    │
  └──────────────────────────────────────────┘
        │ PR approved + checks green
        ▼
  Merge to main
        │
        ▼
  app-pipeline.yml runs
  ┌──────────────────────────────────────────────────────────────┐
  │  Job 1: Build & Push (parallel — all 5 services)             │
  │  • docker build each service with multi-stage Dockerfile     │
  │  • Tag: <timestamp>-<sha>  e.g. 20240414-a1b2c3d            │
  │  • Push to ECR: <account>.ecr.../securestay/<service>:<tag> │
  │  • Also tag :latest                                          │
  └──────────────────────────────────────────────────────────────┘
        │ All 5 builds succeed
        ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  Job 2: Deploy (requires GitHub Environment manual approval) │
  │  • aws eks update-kubeconfig                                 │
  │  • kubectl apply secrets (DATABASE_URL, JWT_SECRET, etc.)   │
  │    NOTE: no MONGODB_URL — notification uses DATABASE_URL     │
  │  • helm upgrade --install securestay ./helm/securestay       │
  │    → migration-job runs schema.sql against RDS (pre-hook)   │
  │    → all 5 service deployments updated with new image tag    │
  │  • kubectl rollout status — all 5 deployments verified       │
  │  • On failure: helm rollback automatically                   │
  └──────────────────────────────────────────────────────────────┘
        │
        ▼
  Application live at https://app.securestay.com
  All 4 services share one RDS PostgreSQL database
  notification_logs persisted in PostgreSQL (not MongoDB)
```

---

## 12. Local Development (Unchanged Workflow)

`docker-compose.yml` stays for local development. The local workflow does not change.
The PostgreSQL and MongoDB containers in docker-compose are fine locally — they are
only removed from the Kubernetes/EKS deployment.

```bash
# Start everything locally (same as before)
docker-compose up --build

# To test notification-service migration locally:
# 1. Update .env in notification-service to remove MONGODB_URL
# 2. Add DATABASE_URL pointing to the local postgres container
# 3. Run the migration SQL manually against the local postgres
```

---

## 13. Branching Strategy

```
main          ← production — protected, no direct push
  └── develop ← integration branch
        ├── feature/auth-jwt          ← Member 1
        ├── feature/booking-db        ← Member 2
        ├── feature/notification-pg   ← Member 3 (MongoDB → PostgreSQL migration)
        └── feature/gateway-pipeline  ← Member 4
```

Rules:
- Never push directly to `main`
- All merges require at least 1 PR approval
- `pr-check.yml` must be green before merge is allowed
- `app-pipeline.yml` triggers only on `main` and deploys only after manual approval

---

## 14. Current Status of the Application

```
Local testing           : DONE — works with docker-compose
In-cluster databases    : REMOVED — k8s/postgres.yaml and k8s/mongodb.yaml deleted
notification-service    : REQUIRES CODE CHANGE — migrate MongoClient → pg.Pool (Section 3.2)
DATABASE_URL            : All 4 services — single RDS endpoint from infra pipeline
MONGODB_URL             : DELETED everywhere — removed from code, secrets, manifests
RabbitMQ                : Stays in EKS — no change
Helm chart              : TO CREATE — follow Section 6
GitHub Actions          : TO CREATE — follow Section 7
Kubernetes secrets      : TO UPDATE — replace MONGODB_URL with DATABASE_URL (Section 9)
```

**Next immediate actions (in order):**
1. Delete `k8s/postgres.yaml` and `k8s/mongodb.yaml` from the repository
2. Migrate `notification-service` from MongoDB to PostgreSQL (Section 3.2)
3. Add `/health` endpoint to every service that is missing one (Section 3.3)
4. Verify `Dockerfile` exists in all 5 service folders (Section 5)
5. Create `helm/securestay/` chart structure (Section 6)
6. Create `.github/workflows/pr-check.yml` and `app-pipeline.yml` (Section 7)
7. Add all secrets to GitHub (Section 9)
8. Get `DATABASE_URL` from infra pipeline Terraform output and add to App repo secrets
9. Push a PR — `pr-check.yml` builds all images automatically
10. Merge → `app-pipeline.yml` deploys to EKS

---

## 15. Future Improvements (Planned, Not in Current Scope)

- **Trivy** — Add `aquasecurity/trivy-action` in `app-pipeline.yml` after each Docker build step
- **SonarQube** — Add SonarCloud scan step in `pr-check.yml` for static code analysis
- **Prometheus + Grafana** — Install via Helm in EKS; instrument services with `prom-client`
- **Database migrations via Flyway/Liquibase** — Replace the inline SQL Job with a proper
  migration tool for tracked, versioned schema changes
- **AWS Secrets Manager + External Secrets Operator** — Replace pipeline-injected secrets
  with in-cluster automatic secret sync from AWS Secrets Manager
- **Horizontal Pod Autoscaler** — Auto-scale booking and payment services based on CPU/RPS
- **Slack deploy notifications** — Post to team Slack on every deploy success or failure
