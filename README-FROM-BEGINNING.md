# SecureStay: Complete Setup from Absolute Beginning

This guide is for a **completely fresh machine** with **no code, no tools installed yet**. Follow every step exactly.

## 0. Prerequisites Install (Linux/Ubuntu - Adapt for your OS)

### Install Git
```bash
sudo apt update
sudo apt install git
git --version
```

### Install Docker & Docker Compose
```bash
sudo apt install docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER  # Logout/login after
docker --version
docker compose version
```

### Install Node.js (services use it)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

### Install Minikube & Kubectl (for K8s later)
```bash
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
minikube version

curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install kubectl /usr/local/bin/kubectl
kubectl version --client
```

## 1. Clone Repository on Branch `lasindu`

```bash
cd ~
git clone -b lasindu https://github.com/nimeshayasith/SecureStay.git
cd SecureStay
ls  # Verify structure: services/, frontend/, etc.
```

**Success check:** You see `docker-compose.yml`, `services/`, `frontend/`, etc.

## 2. Quick Verify & Run with Docker Compose

```bash
docker compose up --build -d
docker compose ps  # All services healthy
```

- Frontend: http://localhost:3001
- Gateway: http://localhost:4000/health

Test flow: Register → Login → Browse hotels → Book → Pay (CVV !=000).

Stop: `docker compose down -v`

## 3. Create Docker Hub Account & Push Images

### Create Account
1. Go to https://hub.docker.com/signup
2. Username: e.g. `yourusername`
3. Create repos: `securestay-gateway`, `securestay-frontend`, `securestay-auth`, etc. (one per service)

### Build & Tag & Push (example for gateway)
```bash
docker build -t yourusername/securestay-gateway:latest ./gateway/
docker push yourusername/securestay-gateway:latest
```

Repeat for:
- frontend
- services/auth-service
- services/booking-service
- services/payment-service
- services/notification-service

**docker-compose.prod.yml** example for prod (uses your images):
```yaml
services:
  gateway:
    image: yourusername/securestay-gateway:latest
    # ...
```

## 4. K8s Setup (Optional, after docker-compose works)

```bash
minikube start
kubectl apply -f k8s/
minikube dashboard
```

Verify: `kubectl get pods`

## Troubleshooting
- Docker perms: `sudo chown -R $USER ~/.docker`
- Rebuild: `docker compose down -v && docker compose up --build -d`
- Logs: `docker compose logs -f gateway`

