variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used for resource naming and tagging"
  type        = string
  default     = "securestay"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

# ─── Networking ───────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "allowed_ssh_cidr" {
  description = "CIDR allowed to SSH into the EC2 instance. Restrict to your IP in production."
  type        = string
  default     = "0.0.0.0/0" # ⚠ Restrict this to your IP: e.g. "203.0.113.10/32"
}

# ─── EC2 ──────────────────────────────────────────────────────────────────────

variable "instance_type" {
  description = "EC2 instance type. t3.micro is AWS Free Tier eligible."
  type        = string
  default     = "t3.micro"
}

variable "key_name" {
  description = "Name of an existing EC2 Key Pair for SSH access. Leave empty to skip key pair (use SSM Session Manager instead)."
  type        = string
  default     = ""
}

variable "repo_url" {
  description = "Git repository URL to clone onto the EC2 instance."
  type        = string
  default     = "https://github.com/nimeshayasith/SecureStay.git"
}

variable "repo_branch" {
  description = "Git branch to clone."
  type        = string
  default     = "kaveesha"
}

variable "github_token" {
  description = "GitHub Personal Access Token for cloning a private repo. Create one at: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained → Contents: Read-only."
  type        = string
  sensitive   = true
  default     = ""
}

# ─── RDS ──────────────────────────────────────────────────────────────────────

variable "db_instance_class" {
  description = "RDS instance class. db.t3.micro is AWS Free Tier eligible."
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "Name of the PostgreSQL database"
  type        = string
  default     = "securestay"
}

variable "db_username" {
  description = "Master username for RDS PostgreSQL"
  type        = string
  default     = "securestay"
}

variable "db_password" {
  description = "Master password for RDS PostgreSQL. Use a strong password in production."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.db_password) >= 8
    error_message = "Database password must be at least 8 characters."
  }
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB. Free Tier allows up to 20 GB."
  type        = number
  default     = 20
}

# ─── Application ──────────────────────────────────────────────────────────────

variable "jwt_secret" {
  description = "JWT signing secret for the auth service"
  type        = string
  sensitive   = true
  default     = "securestay-change-this-in-production"
}
