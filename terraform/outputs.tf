output "ec2_public_ip" {
  description = "Elastic IP of the application server"
  value       = aws_eip.app.public_ip
}

output "ec2_public_dns" {
  description = "Public DNS name of the application server"
  value       = aws_eip.app.public_dns
}

output "frontend_url" {
  description = "SecureStay frontend URL"
  value       = "http://${aws_eip.app.public_ip}:3001"
}

output "gateway_url" {
  description = "API Gateway URL"
  value       = "http://${aws_eip.app.public_ip}:4000"
}

output "gateway_health_url" {
  description = "API Gateway health check endpoint"
  value       = "http://${aws_eip.app.public_ip}:4000/health"
}

output "rabbitmq_ui_url" {
  description = "RabbitMQ Management UI (guest/guest)"
  value       = "http://${aws_eip.app.public_ip}:15672"
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (private — accessible from EC2 only)"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_address" {
  description = "RDS hostname (without port)"
  value       = aws_db_instance.postgres.address
}

output "ssh_command" {
  description = "SSH command (requires key_name variable to be set)"
  value       = var.key_name != "" ? "ssh -i ~/.ssh/${var.key_name}.pem ec2-user@${aws_eip.app.public_ip}" : "No key pair configured — use SSM: aws ssm start-session --target ${aws_instance.app.id}"
}

output "ssm_command" {
  description = "AWS Systems Manager Session Manager command (no SSH key required)"
  value       = "aws ssm start-session --target ${aws_instance.app.id} --region ${var.aws_region}"
}

output "bootstrap_log_command" {
  description = "Command to view the EC2 bootstrap log via SSM"
  value       = "aws ssm start-session --target ${aws_instance.app.id} --region ${var.aws_region} --document-name AWS-StartInteractiveCommand --parameters 'command=sudo tail -f /var/log/user-data.log'"
}
