# SecureStay Cloud Infrastructure Documentation

**Module Name:** Cloud Computing  
**Module Number:** EC7205  
**Project:** SecureStay - Cloud Infrastructure and Deployment Documentation

## Introduction

SecureStay is a hotel booking platform built using a microservice architecture. The project was developed first in a local environment and then migrated to AWS to demonstrate core cloud computing concepts such as scalability, automation, service isolation, and managed infrastructure.

The final solution uses Terraform for Infrastructure as Code, Amazon EKS for container orchestration, Amazon RDS PostgreSQL for managed storage, Amazon ECR for image storage, and GitHub Actions for CI/CD automation. This document summarizes the architecture, implementation journey, challenges faced, and lessons learned during the cloud deployment of SecureStay.

## Architecture

The SecureStay solution has three connected architecture layers: application services, AWS infrastructure, and deployment automation.

At the application layer, the system follows a microservice architecture. The **frontend** provides the user interface, the **API Gateway** is the client entry point, the **Auth Service** manages login and JWT-based access, the **Booking Service** handles hotels and reservations, the **Payment Service** processes payments and updates booking status, and the **Notification Service** consumes events. This separation supports modular development and easier deployment.

The services use both synchronous and asynchronous communication. Client requests flow through the API Gateway using REST, while booking and payment events are published through RabbitMQ and consumed by the Notification Service. PostgreSQL stores the core application data in the deployed environment.

At the cloud layer, the system runs inside an AWS VPC with public and private subnets across multiple Availability Zones. Amazon EKS hosts the containerized services, Amazon RDS provides managed PostgreSQL storage, Amazon ECR stores Docker images, and Route 53 supports domain-based access. IAM roles, security groups, NAT Gateways, and route tables control access and connectivity.

At the automation layer, GitHub Actions manages CI/CD. The pipeline builds Docker images, pushes them to ECR, applies deployment changes to EKS, and verifies service health after rollout. Terraform is used to create and manage the AWS resources in a repeatable way.

> **Figure 1:** Insert the SecureStay microservice architecture diagram here.
>
> Suggested caption: *SecureStay microservice architecture showing the frontend, API Gateway, Auth Service, Booking Service, Payment Service, Notification Service, PostgreSQL, and RabbitMQ.*

> **Figure 2:** Insert the SecureStay cloud infrastructure diagram here.
>
> Suggested caption: *SecureStay AWS cloud architecture showing VPC, EKS, RDS, ECR, RabbitMQ, Route 53, and GitHub Actions integration.*

> **Figure 3:** Insert the SecureStay pipeline diagram here.
>
> Suggested caption: *SecureStay CI/CD flow from GitHub Actions to ECR and EKS deployment.*

## Implementation Steps

The implementation was completed in stages, starting from local development and moving gradually toward a fully automated AWS deployment.

1. **Requirement analysis and architecture planning**  
   The team identified the main business functions and divided them into separate services. Database design, API contracts, and RabbitMQ event flow were planned early to support parallel development.

2. **Local service implementation and testing**  
   The application was first built and tested locally. PostgreSQL, RabbitMQ, and MongoDB were started as local dependencies, while the services were run through Node.js to validate business logic, authentication, and service communication.

3. **Containerization with Docker Compose**  
   After local validation, each service was packaged into Docker containers. Docker Compose was then used to run the full system in one reproducible environment and reduce machine-specific issues.

4. **Kubernetes deployment in a local cluster**  
   Before moving to AWS, the application was deployed to a local Kubernetes cluster using Minikube. This stage introduced pod management, service discovery, health checks, and secret handling in a Kubernetes environment.

5. **Infrastructure as Code setup with Terraform**  
   Once the application behavior was stable, Terraform was introduced to automate cloud infrastructure. An S3 backend and DynamoDB locking were configured to make infrastructure changes safer and repeatable.

6. **AWS networking and platform provisioning**  
   Terraform created the AWS platform, including the VPC, subnets, IAM roles, EKS cluster, managed node group, RDS PostgreSQL, ECR repositories, and supporting services. This formed the final cloud environment.

7. **Cloud-native deployment to Amazon EKS**  
   After the infrastructure was ready, the services were deployed to Amazon EKS using Docker images, Kubernetes manifests, and Helm templates. RabbitMQ and application secrets were configured inside the cluster.

8. **CI/CD pipeline integration and verification**  
   GitHub Actions automated image building, ECR publishing, Kubernetes secret creation, Helm deployment, and rollout checks. Final validation confirmed pod health, service readiness, and database connectivity.

## Challenges Faced

Several issues appeared while connecting AWS provisioning with Kubernetes deployment.

The first challenge was **Terraform state locking and workflow coordination**. Because remote state was stored in S3 with DynamoDB locking, overlapping Terraform runs could block or conflict with each other.

The second challenge was **ingress and load balancer provisioning**. Some deployments timed out because supporting Kubernetes components were not fully ready, and stale webhook resources interfered with service creation.

Another challenge was **limited EKS pod capacity**. Small worker nodes caused pod IP exhaustion when system services, RabbitMQ, ingress, and application workloads were running together.

The team also faced **database connection and migration issues**. Incorrect PostgreSQL connection settings in Kubernetes secrets caused the migration job to fail even when the infrastructure itself had been created successfully.

Finally, **dependency sequencing** was a major practical issue. The application could only be deployed after EKS, ingress, RabbitMQ, secrets, and database access were all confirmed to be healthy.

## Lessons Learned

This project provided several important lessons in cloud computing.

The first lesson was that **Infrastructure as Code is essential for repeatable deployments**. Terraform made the AWS platform easier to recreate, review, and maintain than manual console-based setup.

The second lesson was that **managed services simplify operations but still require careful integration**. EKS, RDS, ECR, and Route 53 reduced operational effort, but the dependencies between them had to be understood clearly.

Another lesson was that **automation must include validation**. Preflight checks for secrets, pod capacity, RabbitMQ readiness, and rollout status were necessary to make the deployment pipeline reliable.

The project also showed that **security and network design should be planned early**. Private database placement, controlled security group access, encrypted storage, and secret management all improved the final architecture.

Finally, the team learned that **cloud deployment is an iterative process**. Troubleshooting cluster capacity, ingress behavior, and configuration errors improved both the final system and the team's practical understanding of AWS and Kubernetes.

## Conclusion

SecureStay evolved from a locally tested microservice system into a cloud-based deployment platform built on AWS. By combining Terraform, EKS, RDS, ECR, RabbitMQ, Helm, and GitHub Actions, the project demonstrates a practical cloud-native deployment approach for a multi-service application.

The final outcome is both a working cloud environment and a strong learning example of modern cloud engineering practices such as automation, modular infrastructure design, CI/CD, and deployment troubleshooting.
