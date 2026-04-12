# RDS requires a subnet group spanning at least 2 AZs

resource "aws_db_subnet_group" "main" {
  name        = "${local.name_prefix}-db-subnet-group"
  description = "Subnet group for SecureStay RDS in private subnets"
  subnet_ids  = aws_subnet.private[*].id

  tags = { Name = "${local.name_prefix}-db-subnet-group" }
}

resource "aws_db_instance" "postgres" {
  identifier = "${local.name_prefix}-postgres"

  # Free Tier: PostgreSQL, db.t3.micro, 20 GB gp2, single-AZ
  engine               = "postgres"
  engine_version       = "16"
  instance_class       = var.db_instance_class
  allocated_storage    = var.db_allocated_storage
  storage_type         = "gp2"
  multi_az             = false # Multi-AZ is NOT Free Tier
  publicly_accessible  = false # Only accessible from within the VPC

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # Free tier accounts restrict automated backups; 0 disables them for dev
  backup_retention_period = 0
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Prevent accidental deletion — set to false for dev/test environments
  deletion_protection = false
  skip_final_snapshot = true # Set to false in production

  # Performance Insights is free for 7 days retention
  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  tags = { Name = "${local.name_prefix}-postgres" }
}
