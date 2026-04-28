# Nimesha Demo Script - AWS Cloud Infrastructure

## Purpose

This is the full speaking script for Nimesha's part of the SecureStay demo video.

Target duration: about 5 minutes.

Main goal:

```text
Explain how SecureStay moved from local development to AWS cloud infrastructure,
show the key AWS services, and then hand over to the pipeline section.
```

## Recommended Flow

```text
1. Architecture diagram
2. Local vs cloud transition
3. AWS Console overview
4. Kubernetes in EKS
5. Public frontend
6. Challenges and benefits
7. Handoff to Diani
```

## Screen Plan

Use these visuals while speaking:

1. SecureStay AWS architecture diagram
2. AWS Console:
   - VPC
   - Subnets
   - EKS
   - RDS
   - ECR
3. Terminal:
   - `kubectl get nodes -o wide`
   - `kubectl get pods -n securestay -o wide`
   - `kubectl get svc -n securestay -o wide`
   - `kubectl get pods -n messaging -o wide`
4. Browser:
   - public frontend URL if available

## Full Script

### Opening

Hello everyone, I'm Nimesha, and now I will explain the AWS cloud infrastructure of our SecureStay project.

Here I'll explain the SecureStay cloud architecture in a simple way.

Users first open the hotel booking application using the website URL. Their request first goes to the AWS Load Balancer. The Load Balancer helps distribute traffic and prevents one server from getting overloaded.

The whole system runs inside an AWS VPC, which is a private cloud network. The VPC is divided into public and private subnets across two Availability Zones. This helps improve security and availability.

Inside AWS EKS, which is Kubernetes on AWS, our application services are running. These services include the frontend, API Gateway, authentication service, booking service, payment service, and notification service. Kubernetes manages these services using pods and automatically restarts them if something fails. It can also scale the application by creating more pods when traffic increases.

The Ingress component routes requests to the correct service based on the URL path.

The application uses Amazon RDS PostgreSQL as the database. The database is placed in private subnets so it is not directly accessible from the internet.

RabbitMQ is used for communication between services. For example, after a booking is completed, RabbitMQ helps send notifications without slowing down the main application.

Docker images of all services are stored in Amazon ECR. GitHub Actions is used as the CI/CD pipeline to automatically build and deploy the application to Kubernetes whenever code is updated.

For security, we use IAM roles, security groups, JWT authentication, and encrypted communication. Overall, this architecture helps the system become scalable, secure, and highly available.

### Transition From Local To Cloud

Compared with our local environment, this cloud environment is much closer to a real production system.

In local development, services run on our own laptop using Docker Compose and Minikube. But in AWS, the services run in a managed Kubernetes platform, the database runs in Amazon RDS, and container images are stored centrally in Amazon ECR.

So the system becomes easier to scale, easier to access publicly, and more reliable than a normal local setup.

### AWS Console Section

Now I will briefly show the AWS resources we used.

First, this is our VPC and subnet structure. We used public subnets for internet-facing access and private subnets for internal resources. This gives a clear separation between public traffic and protected backend resources.

Next, this is our EKS cluster. The worker nodes run our Kubernetes pods. Inside the `securestay` namespace, we have the frontend, API Gateway, auth service, booking service, payment service, and notification service. In the `messaging` namespace, we run RabbitMQ.

Next, this is our Amazon RDS PostgreSQL database. Instead of using a local database container, we used a managed cloud database. This improves reliability and keeps the database protected inside private subnets.

This is our Amazon ECR registry. Here we store Docker images for all services such as frontend, API Gateway, auth service, booking service, payment service, and notification service. These images are later pulled by Kubernetes during deployment.

### Kubernetes Terminal Section

Here we can confirm that the Kubernetes cluster is running in AWS. We can see the nodes, the application pods, and the services.

The `securestay` namespace contains our main application services, and the `messaging` namespace contains RabbitMQ.

The frontend service is exposed through a LoadBalancer, so users can access the application through the public URL.

### Public Frontend Section

This is the public cloud-hosted version of SecureStay. A user can open this in a browser, register, log in, view hotels, create a booking, and make a payment.

So this proves that the system is not only deployed, but also usable from the cloud.

### Challenges Section

Of course, moving to the cloud also created some challenges.

AWS infrastructure is more complex than local deployment. We had to configure IAM, VPC networking, security groups, ingress, pod capacity, and database connections correctly.

We also faced issues such as load balancer delays, pod scheduling limits, and database secret configuration.

But solving these issues helped us understand real cloud deployment much better.

### Closing And Handoff

So overall, AWS gave us a more scalable, secure, and production-like environment for SecureStay.

Terraform helped us create the infrastructure in a repeatable way, and EKS helped us run the application reliably in Kubernetes.

Now Diani will explain how we automated this infrastructure and application deployment using GitHub Actions pipelines.

## Speaker Cues Version

Use this shorter cue-based version if you want something easier to rehearse from.

### Cue 1 - Architecture Diagram

```text
Hello everyone, I'm Nimesha, and now I will explain the AWS cloud infrastructure of our SecureStay project.

Users access the system through the public URL.
Traffic first goes to the AWS Load Balancer.
The system runs inside an AWS VPC with public and private subnets across two Availability Zones.
Inside EKS, Kubernetes runs our frontend, API Gateway, auth, booking, payment, and notification services.
Ingress routes requests to the correct service.
RDS PostgreSQL stores data in private subnets.
RabbitMQ handles asynchronous communication.
ECR stores Docker images.
GitHub Actions automates deployment.
```

### Cue 2 - Local Vs Cloud

```text
In local development, services ran on our laptop using Docker Compose and Minikube.
In AWS, they run in a managed Kubernetes platform with RDS and ECR.
So the cloud version is more scalable, more reliable, and closer to production.
```

### Cue 3 - AWS Console

```text
Here we can see the VPC, subnets, EKS cluster, RDS database, and ECR repositories.
Public subnets handle internet-facing access.
Private subnets protect internal resources.
```

### Cue 4 - Kubernetes

```text
Here we can see the Kubernetes nodes, application pods, and services.
The securestay namespace contains the app services.
The messaging namespace contains RabbitMQ.
The frontend is exposed through a LoadBalancer.
```

### Cue 5 - Challenges

```text
AWS deployment was more complex than local deployment.
We had to solve IAM, networking, ingress, pod capacity, and database connection issues.
But those challenges helped us understand real cloud deployment.
```

### Cue 6 - Handoff

```text
Overall, AWS made SecureStay more scalable, secure, and production-like.
Now Diani will explain the GitHub Actions pipelines used to automate this deployment.
```

## Time Control Tips

If you are speaking too long, shorten these parts:

- Reduce the opening architecture explanation by 2 or 3 sentences.
- Do not explain every AWS service in detail.
- Keep the challenges section to only 2 short sentences.

If you are speaking too fast, slow down slightly at these points:

- VPC and subnet explanation
- EKS and Kubernetes explanation
- Local vs cloud comparison
- final handoff

## Final Advice

- Speak slowly and clearly.
- Do not read too fast from the screen.
- While showing commands, explain only the important result.
- Keep the story simple:

```text
local system -> AWS cloud -> EKS services -> RDS and ECR -> public access -> challenges -> handoff
```
