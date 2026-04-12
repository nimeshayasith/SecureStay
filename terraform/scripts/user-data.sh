#!/bin/bash
# EC2 bootstrap script — runs once at first launch as root
# Terraform templatefile variables: ${db_host}, ${db_user}, ${db_password}, ${db_name}, ${repo_url}, ${jwt_secret}
set -e
exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1

echo "=== SecureStay EC2 Bootstrap Starting ==="

# ─── System Update & Dependencies ────────────────────────────────────────────

dnf update -y
dnf install -y docker git postgresql15

# ─── Docker Setup ─────────────────────────────────────────────────────────────

systemctl start docker
systemctl enable docker
usermod -aG docker ec2-user

# Docker Compose v2 plugin
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL \
  "https://github.com/docker/compose/releases/download/v2.27.0/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Verify
docker --version
docker compose version

# ─── Clone Application ────────────────────────────────────────────────────────

echo "Cloning repository: ${repo_url}"
git clone "${repo_url}" /opt/securestay
chown -R ec2-user:ec2-user /opt/securestay
cd /opt/securestay

# ─── Wait for RDS ─────────────────────────────────────────────────────────────

echo "Waiting for RDS to be ready at ${db_host}..."
export PGPASSWORD="${db_password}"

for i in $(seq 1 36); do
  if pg_isready -h "${db_host}" -p 5432 -U "${db_user}" -d "${db_name}" -q; then
    echo "RDS is ready."
    break
  fi
  echo "  attempt $i/36 — sleeping 10s..."
  sleep 10
done

# ─── Initialize Database Schema ───────────────────────────────────────────────

echo "Applying database schema to RDS..."
psql -h "${db_host}" -p 5432 -U "${db_user}" -d "${db_name}" -f /opt/securestay/database/schema.sql
echo "Schema applied successfully."

# ─── Generate AWS Docker Compose Override ─────────────────────────────────────
# This override:
#   1. Replaces the local postgres container with a harmless dummy (healthcheck still passes)
#   2. Injects the RDS DATABASE_URL into each service that needs it

cat > /opt/securestay/docker-compose.aws.yml << 'COMPOSE_EOF'
services:
  # Replace local postgres with a lightweight dummy.
  # Services that depend on postgres:service_healthy will start once this passes.
  postgres:
    image: alpine:3.18
    command: ["tail", "-f", "/dev/null"]
    healthcheck:
      test: ["CMD", "true"]
      interval: 2s
      timeout: 2s
      retries: 1
      start_period: 1s

  auth-service:
    environment:
      DATABASE_URL: "postgresql://DB_USER:DB_PASS@DB_HOST:5432/DB_NAME"
      JWT_SECRET: "JWT_SECRET_PLACEHOLDER"

  booking-service:
    environment:
      DATABASE_URL: "postgresql://DB_USER:DB_PASS@DB_HOST:5432/DB_NAME"

  payment-service:
    environment:
      DATABASE_URL: "postgresql://DB_USER:DB_PASS@DB_HOST:5432/DB_NAME"
COMPOSE_EOF

# Substitute real values (Terraform has already rendered ${...} above)
sed -i "s|DB_USER|${db_user}|g"             /opt/securestay/docker-compose.aws.yml
sed -i "s|DB_PASS|${db_password}|g"         /opt/securestay/docker-compose.aws.yml
sed -i "s|DB_HOST|${db_host}|g"             /opt/securestay/docker-compose.aws.yml
sed -i "s|DB_NAME|${db_name}|g"             /opt/securestay/docker-compose.aws.yml
sed -i "s|JWT_SECRET_PLACEHOLDER|${jwt_secret}|g" /opt/securestay/docker-compose.aws.yml

# ─── Start Services ───────────────────────────────────────────────────────────

echo "Building and starting services..."
cd /opt/securestay
docker compose -f docker-compose.yml -f docker-compose.aws.yml up -d --build

echo "=== SecureStay Bootstrap Complete ==="
echo "Frontend:    http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3001"
echo "API Gateway: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):4000"
