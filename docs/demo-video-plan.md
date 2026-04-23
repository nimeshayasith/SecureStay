# SecureStay Demo Video Plan

## Video Purpose

This demo video should explain how our group built and deployed the SecureStay hotel booking web application.

The video should tell one simple story:

```text
Local web application -> Docker containers -> Local Kubernetes -> AWS cloud infrastructure -> Automated pipelines
```

Our target time is around 20 minutes. There are 4 presenters, so each person should speak for about 4 to 6 minutes.

## Group Members And Topics

| Presenter | Time | Main Topic |
|---|---:|---|
| Kaweesha | 3 minutes | Project introduction and overall idea |
| Lasindu | 5 minutes | Local development, Docker, and Minikube |
| Nimesha | 6 minutes | AWS cloud infrastructure with Terraform |
| Diani | 5 minutes | Infrastructure pipeline and application pipeline |
| All / Kaweesha | 1 minute | Final summary |

## Before Recording

Open these before starting the video:

| Item | Why We Need It |
|---|---|
| GitHub repository | To show project files and workflows |
| Local terminal | To run Docker, Minikube, or kubectl commands |
| Browser | To show frontend user flow |
| AWS Console | To show EKS, RDS, ECR, VPC, and LoadBalancer |
| GitHub Actions page | To show CI/CD pipelines |
| Database command ready | To prove user, booking, and payment data are stored |

Use a fresh test user email in every demo:

```text
demo-user-01@securestay.com
```

Use this password:

```text
Password123!
```

For payment:

```text
CVV 000 = failed payment
Any other CVV = successful payment
```

## Presenter 1: Kaweesha

### Goal

Kaweesha should give the introduction and explain the full project in simple words.

### Time

About 3 minutes.

### What To Show On Screen

Show the project repository and the main folders:

```powershell
Get-ChildItem
Get-ChildItem services
Get-ChildItem .github\workflows
```

Show these folders if possible:

| Folder | Meaning |
|---|---|
| `frontend` | User interface |
| `gateway` | API Gateway |
| `services` | Backend microservices |
| `k8s` | Kubernetes YAML files |
| `helm` | Helm chart for cloud deployment |
| `.github/workflows` | GitHub Actions pipelines |
| `docs` | Project documentation |

### Simple Script

Hello everyone. Our project is called SecureStay. It is a cloud-based hotel booking web application.

The main idea of this project is to show how a normal web application can be developed locally first, then containerized, then deployed to Kubernetes, and finally automated using cloud pipelines.

SecureStay has several microservices. We did not build one large backend. Instead, we separated the system into smaller services. The frontend is used by the customer. The API Gateway receives API requests. The Auth Service handles registration and login. The Booking Service handles hotels, rooms, and bookings. The Payment Service handles payment processing. The Notification Service handles event notifications.

For storage, we use PostgreSQL. For asynchronous communication, we use RabbitMQ. For local development, we used Docker and Minikube. For cloud deployment, we used AWS services such as EKS, RDS, ECR, LoadBalancer, IAM, and VPC. For automation, we used GitHub Actions pipelines.

In this demo, Lasindu will first show the local development and Minikube setup. Then Nimesha will explain the AWS cloud infrastructure. Finally, Diani will explain the pipelines used to automate infrastructure and application deployment.

### Key Points To Mention

| Point | Simple Explanation |
|---|---|
| Microservices | We split the app into small services |
| Docker | We packaged each service into containers |
| Minikube | We tested Kubernetes locally |
| AWS | We deployed the app to cloud infrastructure |
| Terraform | We created cloud resources using code |
| GitHub Actions | We automated build and deployment |

### Handoff Line

Now Lasindu will show how we developed and tested the application locally using Docker and Minikube.

## Presenter 2: Lasindu

### Goal

Lasindu should show that the application worked locally before moving to the cloud.

### Time

About 5 minutes.

### What To Explain

Use simple words:

Docker helped us run all services in the same environment. Docker Compose helped us start the frontend, backend services, PostgreSQL, and RabbitMQ together. After that, we used Minikube to test Kubernetes locally before moving to AWS EKS.

### Demo Part 1: Show Local Docker Setup

Run:

```powershell
docker compose ps
```

If services are not running, run:

```powershell
docker compose up --build -d
```

Show logs:

```powershell
docker compose logs --tail 30 auth-service
docker compose logs --tail 30 gateway
```

### What To Say

Here we can see all services running locally using Docker Compose. This includes the frontend, API Gateway, auth service, booking service, payment service, notification service, PostgreSQL, and RabbitMQ.

Docker Compose is useful because we can start the whole application with one command. This reduces setup problems between different team members.

### Demo Part 2: Open The Local Application

Open:

```text
http://localhost:3001
```

Show the user flow:

1. Register a user.
2. Login.
3. Load hotels.
4. Select a room.
5. Check availability.
6. Create booking.
7. Submit payment.

### Demo Part 3: Show Database Records

After registration:

```powershell
docker compose exec postgres psql -U securestay -d securestay -c "SELECT id, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5;"
```

After booking:

```powershell
docker compose exec postgres psql -U securestay -d securestay -c "SELECT id, user_id, room_id, status, total_amount, created_at FROM bookings ORDER BY created_at DESC LIMIT 5;"
```

After payment:

```powershell
docker compose exec postgres psql -U securestay -d securestay -c "SELECT id, booking_id, amount, status, masked_card_number, created_at FROM payments ORDER BY created_at DESC LIMIT 5;"
```

### What To Say

Now we can see the user data saved in PostgreSQL. This proves that the frontend, API Gateway, Auth Service, and database are working together.

After creating a booking, we can also see booking records in the database. After payment, we can see payment records. This proves the full application flow is working locally.

### Demo Part 4: Show Minikube

Run:

```powershell
minikube status
kubectl get pods
kubectl get svc
kubectl get deployments
```

If frontend is exposed through Minikube:

```powershell
minikube service frontend --url
```

### What To Say

After testing with Docker Compose, we tested the application with Kubernetes locally using Minikube. This helped us understand deployments, pods, services, and service discovery before moving to AWS EKS.

### Key Points To Mention

| Point | Simple Explanation |
|---|---|
| Docker Compose | Runs all services locally |
| PostgreSQL container | Stores local data |
| RabbitMQ container | Handles local event communication |
| Minikube | Local Kubernetes cluster |
| kubectl | Command-line tool to manage Kubernetes |
| Local testing | Helps us find errors before cloud deployment |

### Handoff Line

Now Nimesha will explain how we moved this local system to AWS cloud infrastructure.

## Presenter 3: Nimesha

### Goal

Nimesha should explain the AWS infrastructure and show how the cloud deployment works.

### Time

About 6 minutes.

### What To Explain

Use simple words:

In local development, everything runs on our computer. In cloud deployment, the application runs on AWS. This is closer to a real production environment. AWS gives managed services, public access, better scalability, and better reliability. But it is also more complex and can create cost.

### AWS Services To Show

| AWS Service | Why We Used It |
|---|---|
| VPC | Private network for our cloud resources |
| Public subnets | For internet-facing resources |
| Private subnets | For internal resources like database |
| Internet Gateway | Allows public internet access |
| NAT Gateway | Allows private resources to access internet safely |
| EKS | Managed Kubernetes cluster |
| EC2 worker nodes | Run application pods |
| ECR | Stores Docker images |
| RDS PostgreSQL | Managed cloud database |
| LoadBalancer | Public endpoint for frontend |
| IAM | Controls permissions |
| Security Groups | Controls network traffic |

### Demo Part 1: Show AWS Console

Open AWS Console and show:

1. VPC.
2. Subnets.
3. EKS cluster.
4. EC2 worker nodes.
5. RDS database.
6. ECR repositories.
7. LoadBalancer.

### What To Say

This is our AWS environment. We created a VPC for the project. Inside the VPC, we have subnets, routing, and security groups. EKS runs our Kubernetes cluster. The worker nodes run the application pods. RDS is used as the managed PostgreSQL database. ECR stores our Docker images. The frontend is exposed using an AWS LoadBalancer.

### Demo Part 2: Show Kubernetes In AWS

Run:

```powershell
kubectl config current-context
kubectl get namespaces
kubectl get nodes -o wide
kubectl get pods -n securestay -o wide
kubectl get svc -n securestay -o wide
kubectl get pods -n messaging -o wide
```

### What To Say

Here we can see the EKS cluster from the terminal. The `securestay` namespace contains our application services. The `messaging` namespace contains RabbitMQ. The frontend service is a LoadBalancer, so users can access the application from the internet.

### Demo Part 3: Show Public Frontend URL

Run:

```powershell
kubectl get svc frontend -n securestay -o jsonpath='{.status.loadBalancer.ingress[0].hostname}{"\n"}'
```

Open this in the browser:

```text
http://<frontend-load-balancer-hostname>:3000
```

### What To Say

This is the public URL of our cloud-hosted web application. A user can open this URL in a browser and use the system. The frontend is public, but backend services are internal inside the Kubernetes cluster.

### Demo Part 4: Show Cloud User Flow

In the cloud frontend:

1. Register a new user.
2. Login.
3. Load hotels.
4. Select a room.
5. Create booking.
6. Submit payment.

### Demo Part 5: Show Cloud Database Data

Show latest users:

```powershell
kubectl exec deployment/auth-service -n securestay -- node -e "const {Pool}=require('pg'); const url=new URL(process.env.DATABASE_URL); url.searchParams.delete('sslmode'); const pool=new Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:false}}); pool.query('SELECT email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5').then(r=>{console.table(r.rows); return pool.end();}).catch(e=>{console.error(e.message); process.exit(1);});"
```

Show latest bookings:

```powershell
kubectl exec deployment/booking-service -n securestay -- node -e "const {Pool}=require('pg'); const url=new URL(process.env.DATABASE_URL); url.searchParams.delete('sslmode'); const pool=new Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:false}}); pool.query('SELECT id, status, total_amount, created_at FROM bookings ORDER BY created_at DESC LIMIT 5').then(r=>{console.table(r.rows); return pool.end();}).catch(e=>{console.error(e.message); process.exit(1);});"
```

Show latest payments:

```powershell
kubectl exec deployment/payment-service -n securestay -- node -e "const {Pool}=require('pg'); const url=new URL(process.env.DATABASE_URL); url.searchParams.delete('sslmode'); const pool=new Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:false}}); pool.query('SELECT booking_id, amount, status, masked_card_number, created_at FROM payments ORDER BY created_at DESC LIMIT 5').then(r=>{console.table(r.rows); return pool.end();}).catch(e=>{console.error(e.message); process.exit(1);});"
```

### Local Vs Cloud Comparison

| Area | Local | Cloud |
|---|---|---|
| Running place | Laptop | AWS |
| Kubernetes | Minikube | EKS |
| Database | PostgreSQL container | RDS PostgreSQL |
| Image storage | Local Docker / Docker Hub | ECR |
| Public access | localhost | LoadBalancer DNS |
| Scaling | Limited | Easier with worker nodes |
| Cost | Low | AWS cost applies |
| Complexity | Easier | More complex |

### Advantages Of Cloud

- Users can access the app publicly.
- EKS manages Kubernetes control plane.
- RDS manages PostgreSQL database.
- ECR stores versioned Docker images.
- Infrastructure can be recreated with Terraform.
- It is closer to a real production environment.

### Challenges Of Cloud

- AWS setup is more complex.
- IAM, VPC, security groups, and LoadBalancers must be configured correctly.
- Pod capacity and image pull problems can happen.
- AWS resources can cost money if left running.

### Handoff Line

Now Diani will explain how we automated this cloud infrastructure and application deployment using pipelines.

## Presenter 4: Diani

### Goal

Diani should explain the pipelines in simple words and show how automation helped the project.

### Time

About 5 minutes.

### What To Explain

Use simple words:

Pipelines help us avoid manual work. Instead of building images and deploying services one by one, GitHub Actions can do these steps automatically. We have two main pipeline areas. One pipeline area is for infrastructure, and the other is for the application.

### Pipeline 1: Infrastructure Pipeline

The infrastructure pipeline creates or updates AWS resources using Terraform.

### Infrastructure Pipeline Stages

| Stage | Simple Meaning |
|---|---|
| Checkout | Get the infrastructure code |
| AWS credentials | Login to AWS securely |
| Terraform init | Prepare Terraform |
| Terraform validate | Check the Terraform code |
| Terraform plan | Show what will change |
| Manual approval | Review before applying changes |
| Terraform apply | Create or update AWS resources |
| Outputs | Show useful values like RDS endpoint and EKS name |

### What To Say

The infrastructure pipeline is responsible for creating the cloud foundation. This includes VPC, subnets, EKS, worker nodes, RDS, ECR, IAM, and security groups. Terraform makes this repeatable, so we can recreate the same infrastructure again if needed.

### Pipeline 2: Application Pipeline

The application pipeline builds the app and deploys it to EKS.

### App Pipeline Stages

| Stage | Simple Meaning |
|---|---|
| Prepare | Create one image tag for the release |
| Build | Build Docker images for all services |
| Push | Push images to AWS ECR |
| Secrets | Create Kubernetes secrets |
| Preflight checks | Check pod capacity and RabbitMQ readiness |
| Helm deploy | Deploy services to EKS |
| Verify | Check rollout status and service URLs |
| Rollback | Recover if deployment fails |

### Demo Part 1: Show GitHub Actions

Show:

1. `.github/workflows/pr-check.yml`.
2. `.github/workflows/app-pipeline.yml`.
3. A completed GitHub Actions run.
4. Matrix build jobs.
5. Deploy job.

### What To Say

The PR check workflow builds the Docker images and runs lint checks before merging. This helps us catch problems early. The app pipeline runs after code is pushed to the `aws_cloud` branch. It builds images, pushes them to ECR, and deploys all services to EKS using Helm.

### Demo Part 2: Show ECR Images

Run:

```powershell
aws ecr describe-repositories --region us-east-1
aws ecr describe-images --repository-name securestay/frontend --region us-east-1 --query "imageDetails[0].imageTags"
aws ecr describe-images --repository-name securestay/auth-service --region us-east-1 --query "imageDetails[0].imageTags"
```

### What To Say

Here we can see that Docker images are stored in AWS ECR. The pipeline creates a version tag and also updates the latest tag.

### Demo Part 3: Show EKS Deployment Verification

Run:

```powershell
kubectl get pods -n securestay
kubectl get svc -n securestay
kubectl rollout status deployment/frontend -n securestay
kubectl rollout status deployment/api-gateway -n securestay
kubectl rollout status deployment/auth-service -n securestay
```

### What To Say

After the pipeline deploys the application, we verify that all pods are running and all rollouts are successful. The frontend service gives us the public LoadBalancer URL.

### Important Pipeline Improvements To Mention

| Improvement | Why It Matters |
|---|---|
| One image tag for all services | Keeps one release version consistent |
| Preflight pod capacity check | Stops deployment if EKS cannot schedule pods |
| RabbitMQ readiness check | Makes sure messaging is ready before app deploy |
| Helm deployment | Deploys all services in a controlled way |
| Rollout status check | Confirms each service is healthy |
| Failure diagnostics | Helps debug failed deployments |

### Handoff Line

Now we will give the final summary of what we learned from the project.

## Final Summary

### Who Can Say This

Kaweesha can say this, or each member can say one short sentence.

### Simple Closing Script

In this project, we learned how to build a web application using microservices. We first tested it locally with Docker. Then we deployed it locally with Minikube. After that, we moved it to AWS using EKS, RDS, ECR, and LoadBalancers. Finally, we automated the deployment using GitHub Actions and Terraform.

This project helped us understand the full cloud application lifecycle, from development to containerization, Kubernetes deployment, cloud infrastructure, and CI/CD automation.

## Full Demo Flow Checklist

Use this checklist during the recording:

1. Introduce SecureStay.
2. Explain microservices.
3. Show local Docker setup.
4. Open local frontend.
5. Register and login locally.
6. Show local database records.
7. Show Minikube pods and services.
8. Show AWS infrastructure.
9. Show EKS pods and services.
10. Open cloud frontend URL.
11. Register and login in cloud.
12. Show cloud database records.
13. Show GitHub Actions pipelines.
14. Show ECR images.
15. Show final deployment verification.
16. Give final summary.

## Useful Commands

### Local Docker

```powershell
docker compose up --build -d
docker compose ps
docker compose logs --tail 30 gateway
docker compose logs --tail 30 auth-service
```

### Local Database

```powershell
docker compose exec postgres psql -U securestay -d securestay -c "SELECT email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5;"
docker compose exec postgres psql -U securestay -d securestay -c "SELECT id, status, total_amount, created_at FROM bookings ORDER BY created_at DESC LIMIT 5;"
docker compose exec postgres psql -U securestay -d securestay -c "SELECT booking_id, amount, status, masked_card_number, created_at FROM payments ORDER BY created_at DESC LIMIT 5;"
```

### Minikube

```powershell
minikube status
kubectl get pods
kubectl get svc
kubectl get deployments
minikube service frontend --url
```

### Cloud Kubernetes

```powershell
kubectl config current-context
kubectl get nodes -o wide
kubectl get pods -n securestay -o wide
kubectl get svc -n securestay -o wide
kubectl get pods -n messaging -o wide
```

### Public Frontend URL

```powershell
kubectl get svc frontend -n securestay -o jsonpath='{.status.loadBalancer.ingress[0].hostname}{"\n"}'
```

### Logs

```powershell
kubectl logs deployment/frontend -n securestay --tail=80
kubectl logs deployment/api-gateway -n securestay --tail=100
kubectl logs deployment/auth-service -n securestay --tail=100
```

### ECR

```powershell
aws ecr describe-repositories --region us-east-1
aws ecr describe-images --repository-name securestay/frontend --region us-east-1 --query "imageDetails[0].imageTags"
```

## Important Notes For The Video

- Use simple English.
- Do not show passwords or AWS secret keys.
- Do not spend too much time on one screen.
- If a command output is too long, only explain the important part.
- If a live demo fails, show screenshots or explain the expected output.
- Keep the story connected between presenters.
- Each presenter should clearly hand over to the next presenter.

## Main Lessons Learned

- Docker makes local setup easier.
- Microservices separate responsibilities clearly.
- Kubernetes helps manage containers.
- AWS gives managed cloud services.
- Terraform makes infrastructure repeatable.
- GitHub Actions automates testing, building, and deployment.
- Cloud deployments need careful debugging for networking, secrets, pod capacity, images, and database connections.
