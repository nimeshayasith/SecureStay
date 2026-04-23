# Image Generation Prompts For SecureStay Demo

Use these prompts to create presentation images for the demo video. The images should look consistent, professional, and easy to understand. Suggested style: clean cloud architecture diagram, modern technical presentation, blue and green AWS-inspired color palette, white or light background, readable labels, no unnecessary decorative clutter.

## 1. Overall What We Did

### Purpose

Show the complete project journey from local development to automated cloud deployment.

### Prompt

Create a clean horizontal journey diagram titled "SecureStay Cloud-Native Deployment Journey". Show five connected stages from left to right: "1. Microservices Web Application", "2. Docker Containerization", "3. Local Kubernetes with Minikube", "4. AWS Cloud Infrastructure with Terraform", "5. CI/CD Deployment with GitHub Actions". Under the microservices stage, show small labeled blocks for Frontend, API Gateway, Auth Service, Booking Service, Payment Service, Notification Service, PostgreSQL, and RabbitMQ. Under Docker, show Docker containers. Under Minikube, show Kubernetes pods and services on a laptop. Under AWS, show EKS, ECR, RDS, VPC, LoadBalancer, and IAM. Under CI/CD, show GitHub Actions building images, pushing to ECR, and deploying with Helm. Use a professional cloud architecture style, readable labels, light background, blue and green accent colors, 16:9 aspect ratio.

### Optional Labels

1. Local Development
2. Containerization
3. Kubernetes Testing
4. Cloud Infrastructure
5. Automated Deployment

## 2. Cloud Infrastructure Architecture With AWS Resources

### Purpose

Show the AWS infrastructure built for the final cloud deployment.

### Prompt

Create a detailed AWS cloud architecture diagram for a hotel booking application named "SecureStay". Show a VPC spanning two Availability Zones. Inside the VPC, include public subnets and private subnets. In public subnets, show an internet-facing LoadBalancer for the frontend and EKS worker nodes if applicable. In private subnets, show AWS RDS PostgreSQL and internal application communication. Show AWS EKS cluster running Kubernetes workloads: frontend, api-gateway, auth-service, booking-service, payment-service, notification-service. Show RabbitMQ in a messaging namespace. Show AWS ECR storing Docker images for all services. Show GitHub Actions deploying to EKS. Include Internet Gateway for public access and NAT Gateway for private outbound access if private nodes are shown. Include IAM roles and security groups as security controls. Add arrows: user browser to LoadBalancer, LoadBalancer to frontend, frontend to API Gateway, API Gateway to services, services to RDS, booking/payment to RabbitMQ, GitHub Actions to ECR and EKS. Professional AWS diagram style, official-looking AWS icon style, readable labels, 16:9.

### Numbered Components

1. User Browser
2. Internet Gateway
3. Public LoadBalancer
4. EKS Cluster
5. Frontend Pod
6. API Gateway Pod
7. Microservice Pods
8. RabbitMQ Messaging
9. RDS PostgreSQL
10. ECR Repositories
11. GitHub Actions
12. IAM and Security Groups

## 3. Local Infrastructure Architecture

### Purpose

Show how the project works locally before cloud deployment.

### Prompt

Create a local development architecture diagram titled "SecureStay Local Development Environment". Show a Windows developer laptop running Docker Desktop. Inside Docker Desktop, show Docker Compose containers: frontend, api-gateway, auth-service, booking-service, payment-service, notification-service, PostgreSQL, RabbitMQ. Next to it, show Minikube running local Kubernetes deployments and services. Show kubectl controlling Minikube. Show Docker images being built locally and optionally pushed to Docker Hub. Show browser access to localhost frontend and gateway health endpoint. Use simple icons for Windows, Docker Desktop, Docker Compose, Minikube, kubectl, Docker Hub, PostgreSQL, RabbitMQ, and browser. Make the flow clear: developer edits code, Docker builds containers, Docker Compose runs services, Minikube tests Kubernetes manifests. Clean technical diagram, readable labels, light background, 16:9.

### Numbered Components

1. Windows Local Machine
2. Source Code
3. Docker Desktop
4. Docker Compose
5. PostgreSQL Container
6. RabbitMQ Container
7. Node.js Microservice Containers
8. Frontend Container
9. Minikube Cluster
10. kubectl
11. Browser Testing
12. Docker Hub or Local Image Cache

## 4. Application Pipeline Creation

### Purpose

Show how application code becomes running services in EKS.

### Prompt

Create a CI/CD pipeline diagram titled "SecureStay Application Pipeline". Show GitHub repository on the left with branch "aws_cloud". Show GitHub Actions workflow triggered by push. Show the following stages in order: "Prepare Release Metadata", "Build Docker Images", "Push Images to AWS ECR", "Create Kubernetes Secrets", "Preflight Checks", "Helm Upgrade", "Rollout Verification", "Public Frontend Endpoint". In the build stage, show a matrix for frontend, api-gateway, auth-service, booking-service, payment-service, notification-service. Show ECR repositories storing versioned image tags and latest tags. Show Helm deploying to AWS EKS namespace "securestay". Show checks for pod capacity and RabbitMQ readiness. Show final output as a LoadBalancer URL. Modern DevOps pipeline style, arrows between stages, blue and green accents, readable labels, 16:9.

### Numbered Pipeline Stages

1. Push to `aws_cloud`
2. Generate image tag
3. Build six Docker images
4. Push to ECR
5. Configure kubeconfig
6. Create Kubernetes secrets
7. Check pod capacity
8. Check RabbitMQ readiness
9. Helm deploy to EKS
10. Verify rollout
11. Show frontend LoadBalancer URL

## 5. Infrastructure Pipeline Creation

### Purpose

Show how Terraform creates the AWS foundation for the app pipeline.

### Prompt

Create a Terraform infrastructure pipeline diagram titled "SecureStay Infrastructure Pipeline". Show GitHub Actions running Terraform stages: Checkout, Configure AWS Credentials, Terraform Init, Terraform Format and Validate, Terraform Plan, Manual Approval, Terraform Apply, Terraform Outputs. On the right side, show the AWS resources created: VPC, public subnets, private subnets, route tables, Internet Gateway, NAT Gateway, security groups, IAM roles, EKS cluster, managed node group, ECR repositories, RDS PostgreSQL, LoadBalancer support. Show Terraform state storage as an S3 bucket with DynamoDB lock table if remote state is used. Add arrows from Terraform Apply to AWS resources and from Terraform Outputs to the Application Pipeline. Use a professional infrastructure-as-code visual style, Terraform purple accents mixed with AWS blue/orange, clean labels, 16:9.

### Numbered Pipeline Stages

1. Developer pushes infrastructure code
2. GitHub Actions starts infrastructure workflow
3. Terraform init downloads providers
4. Terraform validate checks configuration
5. Terraform plan previews changes
6. Manual approval protects production
7. Terraform apply provisions AWS resources
8. Terraform outputs feed application deployment

## 6. Microservices Internal Flow

### Purpose

Show what happens when a user registers, books a room, and pays.

### Prompt

Create a microservices sequence diagram for "SecureStay User Booking Flow". Show a user browser interacting with Frontend. Frontend sends API requests to API Gateway. API Gateway routes register and login to Auth Service. Auth Service stores user data in PostgreSQL and returns JWT. User searches hotels and rooms through Booking Service. Booking Service reads rooms from PostgreSQL and creates a booking. Booking Service publishes booking event to RabbitMQ. User submits payment through Payment Service. Payment Service stores payment in PostgreSQL, updates booking status, and publishes payment event to RabbitMQ. Notification Service consumes RabbitMQ events and writes notification logs to PostgreSQL. Use arrows with labels: Register, Login, JWT, Search Hotels, Create Booking, Submit Payment, Publish Event, Consume Event. Clean readable technical style, 16:9.

## 7. Local Vs Cloud Comparison

### Purpose

Support Nimesha's comparison section.

### Prompt

Create a side-by-side comparison infographic titled "Local Deployment vs AWS Cloud Deployment". Left side: Local Environment with Windows laptop, Docker Desktop, Docker Compose, Minikube, local PostgreSQL, local RabbitMQ, localhost access. Right side: AWS Cloud Environment with VPC, EKS, ECR, RDS PostgreSQL, RabbitMQ messaging, LoadBalancer DNS, IAM, security groups, GitHub Actions. Include comparison rows: compute, database, registry, Kubernetes, public access, scaling, reliability, cost, complexity. Use balanced visual design, not too much text, readable labels, 16:9.

## 8. Troubleshooting And Lessons Learned

### Purpose

Show the practical engineering issues solved during the project.

### Prompt

Create a professional troubleshooting summary graphic titled "Cloud Deployment Lessons Learned". Show four problem cards connected to solutions: "Pod Capacity Limit" solved by "Scale EKS node group and check allocatable pods"; "RabbitMQ ImagePullBackOff" solved by "Use working RabbitMQ image and ready endpoints"; "Database SSL Certificate Error" solved by "Configure PostgreSQL SSL correctly"; "Pipeline Deployment Reliability" solved by "Preflight checks, Helm rollout status, diagnostics, rollback". Add small icons for Kubernetes, RabbitMQ, PostgreSQL, GitHub Actions, and AWS. Use calm blue/green colors, readable text, 16:9.

## Prompt Quality Checklist

Before generating images, confirm each image has:

- Clear title.
- Consistent SecureStay branding.
- Readable service names.
- Correct flow arrows.
- 16:9 aspect ratio for video slides.
- No fake credentials, passwords, or sensitive values.
- No overcrowding.
- AWS and Kubernetes concepts represented clearly.

## Suggested Visual Order In The Video

1. Overall project journey.
2. Microservices internal flow.
3. Local development architecture.
4. Cloud infrastructure architecture.
5. Infrastructure pipeline.
6. Application pipeline.
7. Local vs cloud comparison.
8. Troubleshooting and lessons learned.
