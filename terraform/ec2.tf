# Latest Amazon Linux 2023 AMI (x86_64, HVM)
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ─── EC2 Instance ─────────────────────────────────────────────────────────────

resource "aws_instance" "app" {
  ami           = data.aws_ami.al2023.id
  instance_type = var.instance_type

  # Place in first public subnet
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  associate_public_ip_address = true

  # IAM profile — enables SSM Session Manager (connect without SSH key)
  iam_instance_profile = aws_iam_instance_profile.ec2.name

  # Optional SSH key pair
  key_name = var.key_name != "" ? var.key_name : null

  # Bootstrap script — installs Docker, clones repo, connects to RDS
  user_data = templatefile("${path.module}/scripts/user-data.sh", {
    db_host     = aws_db_instance.postgres.address
    db_user     = var.db_username
    db_password = var.db_password
    db_name     = var.db_name
    repo_url    = var.repo_url
    jwt_secret  = var.jwt_secret
  })

  # Root volume — 8 GB is enough for Docker images on Free Tier
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 20
    delete_on_termination = true
    encrypted             = true
  }

  # Wait for RDS to be created first so user-data can connect
  depends_on = [aws_db_instance.postgres]

  tags = { Name = "${local.name_prefix}-app" }

  lifecycle {
    # Prevent replacement when AMI is updated; use aws ec2 replace-root-volume instead
    ignore_changes = [ami]
  }
}

# ─── Elastic IP ───────────────────────────────────────────────────────────────
# Free while the instance is running; billed if the instance is stopped.

resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app.id

  depends_on = [aws_internet_gateway.main]

  tags = { Name = "${local.name_prefix}-eip" }
}
