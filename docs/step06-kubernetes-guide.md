# Step 06: Kubernetes — Complete Beginner Guide for SecureStay

---

## 1. What is Kubernetes?

Imagine you have a hotel with many staff members — receptionists, housekeepers, chefs, and security guards. If one staff member calls in sick, a manager automatically calls a replacement. If the hotel gets more guests than expected, the manager hires more staff. Kubernetes does exactly this, but for software.

**Kubernetes** (also written as **K8s** — the "8" replaces the eight letters between "K" and "s") is an open-source system that:

- **Runs your application containers** (Docker containers) on one or more machines
- **Keeps them alive** — if a container crashes, Kubernetes restarts it automatically
- **Scales them** — if traffic increases, Kubernetes can run more copies automatically
- **Connects them** — gives each service a stable name so other services can find it
- **Manages secrets** — stores passwords and keys securely, not hardcoded in code

Before Kubernetes, developers had to manually start containers, restart them when they crashed, and figure out how services talk to each other. Kubernetes automates all of that.

**K8s vs Docker:**
- Docker = building and running a single container
- Kubernetes = managing hundreds of containers across many machines, automatically

---

## 2. Core Kubernetes Concepts (Plain English)

You need to understand these terms before reading the project files.

### Pod
The smallest unit in Kubernetes. A Pod is one running instance of your container. Think of it as one worker doing a job. Pods are temporary — they can be killed and replaced at any time.

### Deployment
A Deployment tells Kubernetes: "I want 2 copies of this Pod running at all times." If one crashes, Kubernetes creates a replacement. You describe what you want (the desired state) and Kubernetes makes it happen.

### Service
Pods come and go — their internal IP addresses change every time they restart. A Service is a stable name and address that sits in front of Pods. Other services don't talk to Pods directly; they talk to the Service. Think of it like a reception desk — you call reception, not the individual room.

### ConfigMap
Stores non-sensitive configuration data (like environment variables or config files) separately from your container image.

### Secret
Like ConfigMap but for sensitive data — passwords, API keys, tokens. Values are stored encoded (base64) and are not exposed in plain text in logs.

### PersistentVolumeClaim (PVC)
Databases need to save data to disk. Pods are temporary but disk storage should survive pod restarts. A PVC reserves a piece of storage that persists even when the pod is deleted and recreated.

### NodePort
A way to expose a Service to the outside world. By default, services are only accessible inside the Kubernetes cluster. NodePort opens a specific port on the host machine (your laptop or the server) so you can access it from a browser.

---

## 3. How the SecureStay Infrastructure Works in Kubernetes

Below is the full picture of how all pieces connect inside the cluster.

```
                        YOUR BROWSER
                             │
              ┌──────────────┴──────────────┐
              │                             │
         localhost:30081               localhost:30080
              │                             │
         [frontend]                    [gateway]
          React app                  API Gateway
          port 3000                   port 4000
                                          │
                    ┌─────────────────────┼──────────────────────┐
                    │                     │                       │
             [auth-service]       [booking-service]      [payment-service]
               port 4001             port 4002              port 4003
                    │                     │                       │
                    │              [notification-service]         │
                    │                   port 4004                 │
                    │                                             │
              ──────────────────────────────────────────────
                           INTERNAL CLUSTER NETWORK
              ──────────────────────────────────────────────
                    │                     │                       │
              [postgres]            [rabbitmq]             [mongodb]
               port 5432          port 5672/15672           port 27017
```

### What each layer does

**Frontend (React, port 30081)**
The browser-facing UI. Users open `http://localhost:30081` and interact with the application. It talks to the API Gateway.

**API Gateway (port 30080)**
The single entry point for all API calls. The frontend (or any API client) sends requests here. The gateway routes them to the correct microservice:
- `/auth/*` → auth-service
- `/bookings/*` → booking-service
- `/payments/*` → payment-service

**Auth Service (port 4001)**
Handles user registration and login. Issues JWT tokens that other services use to verify identity. Talks to PostgreSQL to store user accounts.

**Booking Service (port 4002)**
Manages hotels, rooms, and bookings. Checks availability, creates reservations. Talks to PostgreSQL for data and RabbitMQ to publish booking events.

**Payment Service (port 4003)**
Processes payment requests, records success or failure. Talks to booking-service internally to update booking status, and publishes payment events to RabbitMQ.

**Notification Service (port 4004)**
Listens to RabbitMQ for events (booking created, payment successful). Sends notifications and logs them in MongoDB.

**PostgreSQL (port 5432)**
Relational database for structured data — users, hotels, rooms, bookings, payments. The schema is automatically applied on first startup from the ConfigMap in `postgres.yaml`.

**RabbitMQ (port 5672 / management UI 15672)**
Message broker. Services publish events ("booking confirmed") and other services subscribe to those events. This decouples services — booking-service does not need to directly call notification-service.

**MongoDB (port 27017)**
Document database used by the notification service to store notification logs. Chosen because notification records are unstructured and don't need relational constraints.

### How a booking flows through the cluster

```
User (browser)
  → frontend (30081)
  → gateway (30080)  [routes to booking-service]
  → booking-service  [creates PENDING booking in PostgreSQL]
  → user submits payment
  → gateway (30080)  [routes to payment-service]
  → payment-service  [records payment in PostgreSQL]
  → payment-service  [publishes "payment.success" event to RabbitMQ]
  → notification-service  [consumes event from RabbitMQ]
  → notification-service  [saves notification log to MongoDB]
  → booking-service  [updates booking status to CONFIRMED in PostgreSQL]
```

No service calls another service directly (except payment → booking for status update). Everything else uses RabbitMQ events, keeping services loosely coupled.

---

## 4. The k8s/ Files — What Each One Does

### `secrets.yaml`
```
securestay-secrets (Kubernetes Secret)
  database-url  →  postgresql://securestay:securestay@postgres:5432/securestay
  jwt-secret    →  securestay-prod-secret-change-before-deployment
  rabbitmq-url  →  amqp://rabbitmq:5672
  mongodb-url   →  mongodb://mongodb:27017
  booking-service-internal-url → http://booking-service:4002
```
All sensitive values live here. Services reference these using `secretKeyRef` so the actual values are never hardcoded in YAML files. **Apply this first before anything else.**

---

### `postgres.yaml`
Creates three things:

1. **ConfigMap** (`postgres-schema`) — Contains the full SQL schema as a file. Postgres will automatically run this SQL on first startup. The schema includes:
   - `users` table (for auth-service)
   - `hotels` and `rooms` tables (for booking-service)
   - `bookings` table (for booking-service)
   - `payments` table (for payment-service)
   - Seed data: 2 hotels and 2 rooms pre-inserted
   - Indexes on frequently queried columns

2. **PersistentVolumeClaim** (1 GB) — Reserves disk space so database data survives pod restarts.

3. **Deployment + Service** — Runs `postgres:16-alpine`. The schema ConfigMap is mounted at `/docker-entrypoint-initdb.d/` which Postgres reads automatically.

---

### `rabbitmq.yaml`
Runs `rabbitmq:3-management-alpine`. Exposes two ports:
- `5672` — AMQP protocol (used by services to publish/consume messages)
- `15672` — Management web UI (view queues, messages, consumers in browser)

No persistent storage — in dev, losing queue data on restart is acceptable.

---

### `mongodb.yaml`
Runs `mongo:7`. Uses `emptyDir` for storage — data is lost if the pod restarts. This is acceptable for notification logs in development. In production, this should use a PersistentVolumeClaim.

---

### `auth.yaml`
- **2 replicas** — two copies of auth-service run simultaneously for availability
- Pulls image `lasindu123/auth-service:1.0` from DockerHub
- Gets `DATABASE_URL` and `JWT_SECRET` from the Secret
- Has **readiness probe** (Kubernetes checks `/health` before sending traffic to a new pod)
- Has **liveness probe** (Kubernetes restarts the pod if `/health` fails repeatedly)
- Service type is ClusterIP (internal only — only gateway can reach it)

---

### `booking.yaml`
- **2 replicas**
- Pulls image `lasindu123/booking-service:1.0`
- Gets `DATABASE_URL`, `JWT_SECRET`, and `RABBITMQ_URL` from the Secret
- Has readiness and liveness probes on port 4002
- Service is ClusterIP (internal only)

---

### `payment.yaml`
- **1 replica**
- Pulls image `lasindu123/payment-service:1.0`
- Gets `DATABASE_URL`, `JWT_SECRET`, `RABBITMQ_URL`, and `BOOKING_SERVICE_INTERNAL_URL` from the Secret
- `BOOKING_SERVICE_INTERNAL_URL` is `http://booking-service:4002` — used to update booking status after payment
- Has readiness and liveness probes on port 4003

---

### `notification.yaml`
- **1 replica**
- Pulls image `lasindu123/notification-service:1.0`
- Gets `RABBITMQ_URL` and `MONGODB_URL` from the Secret
- Has readiness and liveness probes on port 4004

---

### `gateway.yaml`
- **1 replica**
- Pulls image `lasindu123/gateway:1.1`
- Service type is **NodePort** with `nodePort: 30080` — this is what makes port 30080 accessible from your browser
- Knows the internal URLs of all microservices via environment variables

---

### `frontend.yaml`
- **1 replica**
- Pulls image `lasindu123/frontend:1.0`
- Service type is **NodePort** with `nodePort: 30081` — accessible at `http://localhost:30081`

---

## 5. Best Practices in Kubernetes — What to Follow

### Already done correctly in this project

**Secrets for sensitive data**
Passwords and keys are in `secrets.yaml` and referenced with `secretKeyRef`. They are not hardcoded in environment variables inline.

**Readiness and Liveness probes**
Auth, booking, payment, and notification services all have `/health` probes. This prevents Kubernetes from sending requests to a pod before it is ready, and ensures broken pods are restarted automatically.

**PersistentVolumeClaim for PostgreSQL**
The database uses a PVC so data survives pod restarts. This is the correct approach for stateful workloads.

**Multiple replicas for critical services**
Auth-service and booking-service run 2 replicas. If one pod crashes or is being updated, the other continues serving requests with zero downtime.

**Schema auto-init via ConfigMap**
The full database schema is embedded in a ConfigMap and mounted into the Postgres container. On first startup, the schema and seed data are applied automatically without manual steps.

**imagePullPolicy: IfNotPresent**
Images are not re-downloaded if they already exist locally. This speeds up restarts in development.

---

### Things to improve before production

**MongoDB has no persistent storage**
`mongodb.yaml` uses `emptyDir` — all notification logs are lost if the pod restarts. Add a PersistentVolumeClaim (same pattern as postgres.yaml).

**No resource limits defined**
Pods do not declare CPU or memory limits. In a shared cluster, one misbehaving pod can consume all resources and starve others. Add to each container:
```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "500m"
```

**Secrets are stored in plain text in the file**
`secrets.yaml` uses `stringData` which means the values are readable in the file. In production, use a secrets manager (AWS Secrets Manager, HashiCorp Vault) and never commit secrets to git. The `.gitignore` should exclude `secrets.yaml`.

**No Namespace isolation**
All resources are in the `default` namespace. For production, create a dedicated namespace (`kubectl create namespace securestay`) and deploy everything there to isolate resources from other workloads.

**RabbitMQ has no persistent storage and no authentication**
Guest/guest credentials are default. In production, configure a user with a strong password and add a PersistentVolumeClaim.

**The JWT secret in secrets.yaml is a placeholder**
`securestay-prod-secret-change-before-deployment` must be changed to a long random string before any real deployment.

---

## 6. Key Kubernetes Commands for This Project

```bash
# Apply everything (first time setup — order matters)
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/rabbitmq.yaml
kubectl apply -f k8s/mongodb.yaml
kubectl wait --for=condition=ready pod -l app=postgres --timeout=120s
kubectl apply -f k8s/auth.yaml
kubectl apply -f k8s/booking.yaml
kubectl apply -f k8s/payment.yaml
kubectl apply -f k8s/notification.yaml
kubectl apply -f k8s/gateway.yaml
kubectl apply -f k8s/frontend.yaml

# Check all pods are running
kubectl get pods

# Watch pods start up in real time
kubectl get pods -w

# See all services and their ports
kubectl get services

# View logs for a service
kubectl logs -l app=auth-service
kubectl logs -l app=booking-service
kubectl logs -l app=gateway

# Follow logs in real time
kubectl logs -l app=auth-service -f

# Describe a pod (useful when a pod is crashing)
kubectl describe pod <pod-name>

# Restart a deployment (picks up new image or config)
kubectl rollout restart deployment auth-service

# Get a shell inside a running pod
kubectl exec -it <pod-name> -- /bin/sh

# Delete everything and start fresh
kubectl delete -f k8s/

# Check events (Kubernetes-level errors)
kubectl get events --sort-by=.lastTimestamp
```

---

## 7. Access Points After Deployment

| What | URL | Notes |
|---|---|---|
| Frontend | `http://localhost:30081` | React UI |
| API Gateway | `http://localhost:30080` | All API calls go here |
| API Health Check | `http://localhost:30080/health` | Should return 200 OK |
| RabbitMQ UI | Forward port 15672 (see below) | guest / guest |

RabbitMQ management UI is not exposed via NodePort. To access it:
```bash
kubectl port-forward service/rabbitmq 15672:15672
# Then open http://localhost:15672 in browser
# Login: guest / guest
```

---

## 8. Summary

| Concept | What it means in SecureStay |
|---|---|
| Pod | One running container, e.g. one auth-service instance |
| Deployment | "Keep 2 auth-service pods alive at all times" |
| Service (ClusterIP) | Internal stable address — auth-service, booking-service, etc. |
| Service (NodePort) | External access — gateway on 30080, frontend on 30081 |
| Secret | Database password, JWT secret, RabbitMQ URL |
| ConfigMap | The full PostgreSQL schema SQL file |
| PVC | Reserved disk for Postgres data |
| Readiness Probe | "Is this pod ready to receive traffic yet?" |
| Liveness Probe | "Is this pod still healthy? Restart it if not." |
