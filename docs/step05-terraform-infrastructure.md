# Step 05: Terraform Infrastructure (AWS Provisioning)

## What has been done

The `terraform/` directory contains a complete Infrastructure-as-Code setup that provisions the entire SecureStay cloud environment on AWS using Terraform (>= 1.5.0, AWS provider ~> 5.0).

For a retrospective on the infrastructure and deployment issues faced during the final troubleshooting period, see [errors_fix.md](./errors_fix.md).

---

## Files overview

| File | Purpose |
|---|---|
| `main.tf` | Provider config, Terraform version pin, optional S3 remote state backend |
| `vpc.tf` | VPC, subnets (public/private), Internet Gateway, route tables |
| `ec2.tf` | EC2 application server, Elastic IP, AMI data source |
| `rds.tf` | RDS PostgreSQL instance and DB subnet group |
| `security-groups.tf` | Security groups for EC2 and RDS |
| `iam.tf` | IAM role and instance profile for SSM Session Manager |
| `variables.tf` | All input variable declarations with defaults |
| `outputs.tf` | Useful URLs and connection commands printed after `terraform apply` |
| `terraform.tfvars.example` | Template for filling in secrets — not committed to git |
| `scripts/user-data.sh` | EC2 bootstrap script that runs on first launch |

---

## Networking — `vpc.tf`

A dedicated VPC is created with CIDR `10.0.0.0/16`.

**Public subnets** (two, one per AZ):
- `10.0.1.0/24` — `us-east-1a`
- `10.0.2.0/24` — `us-east-1b`
- EC2 instance lives here; traffic reaches the internet through an Internet Gateway.

**Private subnets** (two, one per AZ):
- `10.0.10.0/24` — `us-east-1a`
- `10.0.11.0/24` — `us-east-1b`
- RDS lives here; no direct internet access.

A public route table routes `0.0.0.0/0` to the Internet Gateway and is associated with both public subnets.

---

## Compute — `ec2.tf`

A single EC2 instance runs the entire application stack using Docker Compose.

| Setting | Value |
|---|---|
| AMI | Latest Amazon Linux 2023 (HVM, x86_64) — fetched dynamically |
| Instance type | `t3.micro` (Free Tier eligible) |
| Subnet | First public subnet (`10.0.1.0/24`) |
| Public IP | Static Elastic IP attached to the instance |
| Root volume | 30 GB gp3, deleted on termination |
| SSH key | Optional — leave `key_name` empty to use SSM instead |
| IAM profile | Attached (allows SSM Session Manager access) |

The instance uses a `user_data` bootstrap script rendered from `scripts/user-data.sh`. The Elastic IP is independent of instance stop/start cycles (unlike a default public IP).

---

## Database — `rds.tf`

A managed PostgreSQL 16 instance is provisioned in the private subnets.

| Setting | Value |
|---|---|
| Engine | PostgreSQL 16 |
| Instance class | `db.t3.micro` (Free Tier eligible) |
| Storage | 20 GB gp2 (Free Tier max) |
| Multi-AZ | Disabled (Free Tier) |
| Public access | Disabled — accessible from EC2 only via private IP |
| Deletion protection | Disabled (dev environment) |
| Final snapshot | Skipped (`skip_final_snapshot = true`) |
| Performance Insights | Enabled, 7-day free retention |
| Backups | Disabled (`backup_retention_period = 0`) for dev |

A `db_subnet_group` spans both private subnets (required by AWS RDS).

---

## Security Groups — `security-groups.tf`

### EC2 Security Group

| Port | Protocol | Source | Purpose |
|---|---|---|---|
| 22 | TCP | `allowed_ssh_cidr` (default `0.0.0.0/0`, should be restricted) | SSH |
| 3001 | TCP | `0.0.0.0/0` | React frontend |
| 4000 | TCP | `0.0.0.0/0` | API Gateway |
| 4001–4004 | TCP | `0.0.0.0/0` | Individual microservices (auth, booking, payment, notification) |
| 15672 | TCP | `0.0.0.0/0` | RabbitMQ Management UI |
| All | All | `0.0.0.0/0` (egress) | Outbound (Docker pulls, git clone, RDS) |

### RDS Security Group

| Port | Protocol | Source | Purpose |
|---|---|---|---|
| 5432 | TCP | EC2 security group only | PostgreSQL from application server |

RDS is completely isolated from the internet — only the EC2 instance can reach it.

---

## IAM — `iam.tf`

An IAM role is created for the EC2 instance with the AWS managed policy `AmazonSSMManagedInstanceCore`. This enables **AWS Systems Manager Session Manager** access, meaning you can open a shell on the EC2 instance from the AWS console or CLI without needing an SSH key pair or open port 22.

An instance profile wraps the role so it can be attached to the EC2 instance.

---

## Variables — `variables.tf`

| Variable | Default | Sensitive |
|---|---|---|
| `aws_region` | `us-east-1` | No |
| `project_name` | `securestay` | No |
| `environment` | `dev` | No |
| `vpc_cidr` | `10.0.0.0/16` | No |
| `allowed_ssh_cidr` | `0.0.0.0/0` | No |
| `instance_type` | `t3.micro` | No |
| `key_name` | `""` (SSM mode) | No |
| `repo_url` | SecureStay GitHub URL | No |
| `repo_branch` | `kaveesha` | No |
| `github_token` | `""` | Yes |
| `db_instance_class` | `db.t3.micro` | No |
| `db_name` | `securestay` | No |
| `db_username` | `securestay` | No |
| `db_password` | (required, min 8 chars) | Yes |
| `db_allocated_storage` | `20` | No |
| `jwt_secret` | (placeholder) | Yes |

Sensitive variables are marked with `sensitive = true` so Terraform does not print them in output or plan diffs.

---

## Outputs — `outputs.tf`

After `terraform apply`, the following are printed:

| Output | Example |
|---|---|
| `ec2_public_ip` | Elastic IP address |
| `frontend_url` | `http://<ip>:3001` |
| `gateway_url` | `http://<ip>:4000` |
| `gateway_health_url` | `http://<ip>:4000/health` |
| `rabbitmq_ui_url` | `http://<ip>:15672` |
| `rds_endpoint` | Private endpoint (host:port) |
| `ssh_command` | SSH command or SSM fallback message |
| `ssm_command` | `aws ssm start-session --target <instance-id>` |
| `bootstrap_log_command` | SSM command to tail `/var/log/user-data.log` |

---

## EC2 Bootstrap Script — `scripts/user-data.sh`

This script runs automatically as root on the first EC2 launch. Terraform renders the Terraform variables into it before uploading. The script does the following steps in order:

1. **System update** — `dnf update -y`
2. **Install dependencies** — Docker, Git, `postgresql15` client
3. **Start Docker** — enables the daemon and adds `ec2-user` to the `docker` group
4. **Install Docker Compose v2** — downloads the plugin binary (v2.27.0)
5. **Clone the repository** — uses `github_token` if set (private repo), then scrubs the token from `.git/config`
6. **Wait for RDS** — polls `pg_isready` every 10 seconds up to 36 attempts (6 minutes) before continuing
7. **Apply database schema** — runs `database/schema.sql` against the RDS instance using `psql`
8. **Generate `docker-compose.aws.yml`** — creates a Compose override that:
   - Replaces the local `postgres` container with a dummy `alpine` container
   - Injects `DATABASE_URL` pointing at RDS for `auth-service`, `booking-service`, and `payment-service`
   - Injects `JWT_SECRET` into `auth-service`
9. **Start all services** — `docker compose -f docker-compose.yml -f docker-compose.aws.yml up -d --build`
10. **Print access URLs** — retrieves the public IP from the instance metadata and prints the frontend, API Gateway, and RabbitMQ URLs

All output is logged to `/var/log/user-data.log` and the system journal, viewable via the `bootstrap_log_command` Terraform output.

---

## How to use

```bash
# 1. Copy and fill in secrets
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# Edit terraform.tfvars — set db_password, jwt_secret, github_token (if private repo)

# 2. Initialize Terraform
cd terraform
terraform init

# 3. Preview what will be created
terraform plan

# 4. Deploy
terraform apply

# 5. After apply — check bootstrap progress
# Use the printed ssm_command or bootstrap_log_command output
```

To destroy all resources:

```bash
terraform destroy
```

---

## Architecture summary

```
Internet
   │
   ▼
[Elastic IP] ──► [EC2 t3.micro — Amazon Linux 2023]
                        │  Docker Compose stack:
                        │   - React frontend      :3001
                        │   - API Gateway         :4000
                        │   - auth-service        :4001
                        │   - booking-service     :4002
                        │   - payment-service     :4003
                        │   - notification-service:4004
                        │   - RabbitMQ            :5672 / :15672
                        │
                        │ (private subnet — VPC internal only)
                        ▼
                 [RDS PostgreSQL 16 — db.t3.micro]
```

All resources are tagged with `Project=securestay`, `Environment=dev`, and `ManagedBy=Terraform`.
