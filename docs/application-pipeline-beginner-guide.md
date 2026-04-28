# SecureStay Application Pipeline Beginner Guide

## 1. What Is An Application Pipeline?

An application pipeline is an automated process that takes application source code and deploys it to a running environment.

In simple words:

```text
Code change -> Build Docker images -> Push images to registry -> Deploy to Kubernetes -> Verify application is running
```

For SecureStay, the application pipeline is defined in:

```text
.github/workflows/app-pipeline.yml
```

This pipeline runs when code is pushed to the `aws_cloud` branch.

## 2. Why Do We Need An Application Pipeline?

Without a pipeline, we must do many steps manually:

1. Build each Docker image.
2. Tag each image.
3. Login to AWS.
4. Push each image to ECR.
5. Connect to EKS.
6. Create Kubernetes secrets.
7. Run Helm commands.
8. Check if pods are running.
9. Debug failed deployments.

This is slow and easy to do incorrectly.

The pipeline helps us because:

- It saves time.
- It reduces human mistakes.
- It gives the same deployment process every time.
- It creates a clear deployment history.
- It allows the team to see failures in GitHub Actions.
- It makes the project closer to a real DevOps workflow.

## 3. What Does The SecureStay App Pipeline Deploy?

The pipeline deploys the main application services:

| Service | Purpose |
|---|---|
| `frontend` | User interface |
| `api-gateway` | Main API entry point |
| `auth-service` | User registration and login |
| `booking-service` | Hotel, room, and booking logic |
| `payment-service` | Payment processing |
| `notification-service` | Notification event processing |

It deploys these services to the Kubernetes namespace:

```text
securestay
```

It also depends on other infrastructure that should already exist:

| Dependency | Purpose |
|---|---|
| AWS EKS | Runs Kubernetes workloads |
| AWS ECR | Stores Docker images |
| AWS RDS PostgreSQL | Stores application data |
| RabbitMQ | Handles asynchronous events |
| AWS LoadBalancer | Exposes frontend publicly |

## 4. Correct Order Of The Application Pipeline

The application pipeline must follow the correct order.

If the order is wrong, deployment can fail.

The correct order is:

```text
1. Prepare release metadata
2. Build and push Docker images
3. Configure AWS credentials
4. Connect to EKS
5. Install Helm
6. Create namespace
7. Validate secrets
8. Create Kubernetes secrets
9. Clean old failed resources
10. Check cluster capacity
11. Check RabbitMQ readiness
12. Deploy using Helm
13. Verify images exist
14. Verify Kubernetes rollouts
15. Show pods, services, and public endpoint
16. Roll back if deployment fails
```

## 5. Pipeline Stage By Stage Explanation

## Stage 1: Trigger

The pipeline starts when code is pushed to:

```yaml
on:
  push:
    branches: [aws_cloud]
```

### Why This Is Used

This means the pipeline does not run for every random branch. It runs only when changes are pushed to the cloud deployment branch.

### Best Practice

Use a specific deployment branch or environment branch.

For this project:

```text
aws_cloud = cloud deployment branch
```

## Stage 2: Environment Variables

The workflow defines common values:

```yaml
env:
  AWS_REGION: us-east-1
  CLUSTER_NAME: securestay-eks
  NAMESPACE: securestay
```

### What It Does

These values are reused across the pipeline.

### Why This Is Important

If we hardcode these values many times, it becomes difficult to update them later.

### Best Practice

Put repeated values in `env`.

Example:

```text
AWS region
EKS cluster name
Kubernetes namespace
```

## Stage 3: Prepare Release Metadata

The pipeline creates one image tag:

```bash
SHORT_SHA=$(echo ${{ github.sha }} | cut -c1-7)
TIMESTAMP=$(date +%Y%m%d%H%M%S)
echo "version=${TIMESTAMP}-${SHORT_SHA}" >> $GITHUB_OUTPUT
```

Example image tag:

```text
20260423082015-a1b2c3d
```

### What It Does

It creates a unique version for the deployment.

### Why This Is Important

All services in the same deployment use the same image tag.

This helps us know exactly which version is running.

### Best Practice

Use one release tag for all services in one deployment.

Bad example:

```text
frontend:latest
auth-service:different-tag
booking-service:another-tag
```

Good example:

```text
frontend:20260423082015-a1b2c3d
auth-service:20260423082015-a1b2c3d
booking-service:20260423082015-a1b2c3d
```

## Stage 4: Build And Push Docker Images

The pipeline builds six images:

```yaml
matrix:
  include:
    - service: frontend
      context: ./frontend
    - service: api-gateway
      context: ./gateway
    - service: auth-service
      context: ./services/auth-service
    - service: booking-service
      context: ./services/booking-service
    - service: payment-service
      context: ./services/payment-service
    - service: notification-service
      context: ./services/notification-service
```

### What It Does

GitHub Actions builds Docker images for each service.

Then it pushes them to AWS ECR.

### Why This Is Important

Kubernetes needs container images to run pods.

EKS cannot run source code directly. It runs Docker images.

### Best Practice

Use a build matrix when multiple services follow the same build process.

This avoids writing the same build steps six times.

## Stage 5: Configure AWS Credentials

The pipeline uses:

```yaml
aws-actions/configure-aws-credentials
```

### What It Does

It allows GitHub Actions to access AWS.

### Why This Is Important

The pipeline must access:

- ECR to push images.
- EKS to deploy workloads.
- AWS APIs to check resources.

### Best Practice

Do not write AWS keys directly inside the workflow file.

Use GitHub Secrets:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

## Stage 6: Login To AWS ECR

The pipeline uses:

```yaml
aws-actions/amazon-ecr-login
```

### What It Does

It logs Docker into AWS ECR.

### Why This Is Important

Without ECR login, Docker cannot push images to AWS.

### Best Practice

Use the official AWS ECR login action.

## Stage 7: Ensure ECR Repository Exists

The pipeline checks if each ECR repository exists.

If not, it creates the repository:

```bash
aws ecr create-repository \
  --repository-name "${REPOSITORY}" \
  --region ${{ env.AWS_REGION }} \
  --image-scanning-configuration scanOnPush=true
```

### What It Does

It prevents the image push step from failing because of a missing repository.

### Why This Is Important

Each service needs its own ECR repository.

Example:

```text
securestay/frontend
securestay/api-gateway
securestay/auth-service
securestay/booking-service
securestay/payment-service
securestay/notification-service
```

### Best Practice

Enable image scanning:

```text
scanOnPush=true
```

This helps detect container image vulnerabilities.

## Stage 8: Push Images With Two Tags

The pipeline pushes each image with:

```text
version tag
latest tag
```

Example:

```text
securestay/frontend:20260423082015-a1b2c3d
securestay/frontend:latest
```

### Why Two Tags?

The version tag is used for exact deployment tracking.

The `latest` tag is useful for quick checking and debugging.

### Best Practice

For production deployment, use the version tag instead of only `latest`.

## Stage 9: Deploy Job Starts After Build Job

The deploy job waits for the image build job:

```yaml
needs: [prepare, build-and-push]
```

### What It Does

Deployment starts only after all images are built and pushed.

### Why This Is Important

If deployment starts before images are ready, Kubernetes may fail with image pull errors.

### Best Practice

Use `needs` to control job order.

## Stage 10: Update Kubeconfig

The pipeline runs:

```bash
aws eks update-kubeconfig --region us-east-1 --name securestay-eks
```

### What It Does

It connects GitHub Actions to the EKS cluster.

### Why This Is Important

Without kubeconfig, `kubectl` and `helm` cannot deploy to the cluster.

### Best Practice

Always update kubeconfig before running Kubernetes commands.

## Stage 11: Install Helm

The pipeline installs Helm:

```yaml
azure/setup-helm@v4
```

### What It Does

It makes the `helm` command available in GitHub Actions.

### Why Helm Is Used

Helm helps deploy multiple Kubernetes resources together.

Instead of applying many YAML files manually, Helm deploys the whole application chart.

### Best Practice

Use Helm for repeatable Kubernetes application deployments.

## Stage 12: Create Namespace

The pipeline creates the namespace:

```bash
kubectl create namespace securestay --dry-run=client -o yaml | kubectl apply -f -
```

### What It Does

It creates the `securestay` namespace if it does not already exist.

### Why This Is Important

Namespaces separate application resources from other cluster resources.

### Best Practice

Use `--dry-run=client -o yaml | kubectl apply -f -`

This makes the command safe to run many times.

## Stage 13: Validate Secret Formats

The pipeline checks:

```text
DATABASE_URL
RABBITMQ_URL
```

### What It Does

It confirms that important secret values have the correct format before deployment.

### Why This Is Important

If secrets are wrong, pods may start but the application will fail at runtime.

Example failure:

```text
Database connection failed
RabbitMQ connection failed
Internal Server Error
```

### Best Practice

Validate secrets before deployment.

Do not wait until the app crashes.

## Stage 14: Create Kubernetes Secret

The pipeline creates or updates:

```text
securestay-secrets
```

It stores:

```text
database-url
jwt-secret
rabbitmq-url
payment-secret
```

### What It Does

It gives services access to required secret values.

### Why This Is Important

Applications need secrets, but secrets should not be hardcoded in source code.

### Best Practice

Store sensitive values in GitHub Secrets and Kubernetes Secrets.

Do not commit passwords to GitHub.

## Stage 15: Clean Up Old Failed Resources

The pipeline deletes old failed pods and jobs:

```bash
kubectl delete pod -n securestay --field-selector=status.phase=Pending --ignore-not-found=true || true
kubectl delete job/securestay-db-migrate -n securestay --ignore-not-found=true || true
```

It also scales old app deployments to zero before deploying again.

### What It Does

It removes old failed deployment leftovers.

### Why This Is Important

Old pending pods or old migration jobs can block the new deployment.

### Best Practice

Clean only known resources.

Do not delete the whole namespace unless you really need to.

## Stage 16: Preflight Cluster Pod Capacity Check

The pipeline checks:

```text
Total pod slots
Active pods
Free pod slots
Required pods
```

### What It Does

It checks whether the EKS cluster has enough pod capacity before deployment.

### Why This Is Important

Even if CPU and memory look enough, Kubernetes can still fail because nodes have pod limits.

This project had a real issue where pods could not schedule because the cluster had too few pod slots.

### Best Practice

Check pod capacity before deploying.

This gives a clear error instead of waiting for pods to stay pending.

## Stage 17: Preflight RabbitMQ Readiness Check

The pipeline checks whether RabbitMQ has a ready endpoint:

```bash
kubectl get endpoints rabbitmq -n messaging
```

### What It Does

It confirms RabbitMQ is ready before deploying services that depend on it.

### Why This Is Important

Booking, payment, and notification services use RabbitMQ.

If RabbitMQ is not ready, the application may start with messaging errors.

### Best Practice

Check dependency readiness before deploying application services.

## Stage 18: Helm Upgrade Or Install

The main deployment command is:

```bash
helm upgrade --install securestay ./helm/securestay \
  --namespace securestay \
  --create-namespace \
  --timeout 10m \
  --set global.imageRegistry=${ECR} \
  --set frontend.tag=${IMAGE_TAG} \
  --set apiGateway.tag=${IMAGE_TAG} \
  --set authService.tag=${IMAGE_TAG} \
  --set bookingService.tag=${IMAGE_TAG} \
  --set paymentService.tag=${IMAGE_TAG} \
  --set notificationService.tag=${IMAGE_TAG}
```

### What It Does

It deploys or updates the SecureStay application in EKS.

### Why This Is Important

`helm upgrade --install` works for both first deployment and later updates.

If the release does not exist, Helm installs it.

If the release already exists, Helm upgrades it.

### Best Practice

Use `helm upgrade --install` for repeatable deployments.

Use `--timeout` so the pipeline does not wait forever.

Use image tags from the pipeline, not manually edited YAML.

## Stage 19: Verify ECR Images Exist

After deployment, the pipeline checks if the expected images exist in ECR.

### What It Does

It confirms that every service image was pushed correctly.

### Why This Is Important

If an image does not exist, Kubernetes cannot pull it.

### Best Practice

Verify artifacts before or during rollout checks.

## Stage 20: Verify Rollout Status

The pipeline checks each deployment:

```bash
kubectl rollout status deployment/frontend -n securestay --timeout=5m
kubectl rollout status deployment/api-gateway -n securestay --timeout=5m
kubectl rollout status deployment/auth-service -n securestay --timeout=5m
```

### What It Does

It waits until Kubernetes confirms that each service is running correctly.

### Why This Is Important

A Helm command can finish, but pods may still fail later.

Rollout checks confirm the application is actually healthy.

### Best Practice

Always verify deployment health after deploying.

## Stage 21: Diagnostics On Failure

If deployment fails, the pipeline prints:

```text
Pods
Services
Events
Jobs
Deployment descriptions
Pod logs
```

### What It Does

It gives debugging information directly in GitHub Actions.

### Why This Is Important

Without diagnostics, we must manually inspect the cluster after failure.

### Best Practice

Collect logs and events automatically when deployment fails.

## Stage 22: Rollback On Failure

If deployment fails, the pipeline tries to roll back:

```bash
helm rollback securestay --namespace securestay
```

If there is no previous release, it uninstalls the failed release.

### What It Does

It tries to return the app to a stable state.

### Why This Is Important

A failed deployment should not leave the system broken.

### Best Practice

Add rollback logic for production deployments.

## 6. Best Practices Used In This Project

## Best Practice 1: Separate Infrastructure And Application Pipelines

Infrastructure changes and application changes are different.

Infrastructure pipeline creates:

```text
VPC
EKS
RDS
ECR
IAM
Security groups
LoadBalancer support
```

Application pipeline deploys:

```text
Frontend
API Gateway
Microservices
Helm chart
Kubernetes secrets
```

### Why This Is Good

Infrastructure changes are usually less frequent and more risky.

Application changes happen more often.

Keeping them separate makes the project easier to manage.

## Best Practice 2: Use Docker Images For Every Service

Each microservice has its own Docker image.

### Why This Is Good

Each service can be built, versioned, and deployed independently.

## Best Practice 3: Store Images In ECR

ECR is AWS's container image registry.

### Why This Is Good

EKS can pull images from ECR securely and reliably.

## Best Practice 4: Use One Version Tag Per Release

All services use the same generated image tag.

### Why This Is Good

It is easier to track which version is deployed.

## Best Practice 5: Use GitHub Secrets

Sensitive values are stored in GitHub Secrets.

### Why This Is Good

Passwords and keys are not committed to GitHub.

## Best Practice 6: Use Kubernetes Secrets

The pipeline creates `securestay-secrets` in Kubernetes.

### Why This Is Good

Pods can read secret values securely from Kubernetes.

## Best Practice 7: Validate Before Deploy

The pipeline validates:

```text
DATABASE_URL
RABBITMQ_URL
Pod capacity
RabbitMQ readiness
```

### Why This Is Good

It fails early with a clear reason.

## Best Practice 8: Use Helm

Helm deploys all application resources together.

### Why This Is Good

It makes deployment repeatable and easier to update.

## Best Practice 9: Verify After Deploy

The pipeline checks rollout status.

### Why This Is Good

It confirms that Kubernetes actually started the pods successfully.

## Best Practice 10: Add Failure Diagnostics

The pipeline prints logs and events on failure.

### Why This Is Good

It helps debug problems faster.

## 7. Common Pipeline Problems And Fixes

| Problem | Simple Meaning | Fix |
|---|---|---|
| ImagePullBackOff | Kubernetes cannot pull image | Check image tag and ECR repository |
| Pending pods | Pods cannot schedule | Check node capacity and resources |
| CrashLoopBackOff | Container starts and crashes | Check pod logs |
| Secret error | App cannot read configuration | Check GitHub Secrets and Kubernetes Secrets |
| Database connection error | Service cannot connect to RDS | Check `DATABASE_URL`, security groups, SSL |
| RabbitMQ connection error | Messaging service unavailable | Check RabbitMQ pod and endpoints |
| LoadBalancer not reachable | Public URL not working | Check service, security group, and AWS LoadBalancer |

## 8. Commands To Understand The Pipeline Result

### Check Pods

```powershell
kubectl get pods -n securestay -o wide
```

### Check Services

```powershell
kubectl get svc -n securestay -o wide
```

### Get Frontend Public URL

```powershell
kubectl get svc frontend -n securestay -o jsonpath='{.status.loadBalancer.ingress[0].hostname}{"\n"}'
```

### Check Rollout

```powershell
kubectl rollout status deployment/frontend -n securestay
kubectl rollout status deployment/api-gateway -n securestay
kubectl rollout status deployment/auth-service -n securestay
```

### Check Logs

```powershell
kubectl logs deployment/frontend -n securestay --tail=80
kubectl logs deployment/api-gateway -n securestay --tail=100
kubectl logs deployment/auth-service -n securestay --tail=100
```

### Check RabbitMQ

```powershell
kubectl get pods -n messaging -o wide
kubectl get endpoints rabbitmq -n messaging -o wide
```

### Check ECR Images

```powershell
aws ecr describe-repositories --region us-east-1
aws ecr describe-images --repository-name securestay/frontend --region us-east-1 --query "imageDetails[0].imageTags"
```

## 9. Simple Explanation For Demo Video

You can explain the application pipeline like this:

SecureStay uses an application pipeline to automatically deploy our microservices to AWS EKS. When we push code to the `aws_cloud` branch, GitHub Actions starts the pipeline. First, it creates one release tag. Then it builds Docker images for the frontend, API Gateway, and all backend services. After that, it pushes those images to AWS ECR. Then the pipeline connects to the EKS cluster, creates Kubernetes secrets, checks cluster capacity, checks RabbitMQ readiness, and deploys the application using Helm. Finally, it verifies that all deployments are running successfully and prints the frontend public endpoint.

This is important because it makes deployment faster, safer, and more consistent. It also helps the team find errors quickly through logs and diagnostics in GitHub Actions.

## 10. Final Beginner Summary

The application pipeline is the bridge between code and cloud deployment.

It answers these questions:

| Question | Pipeline Answer |
|---|---|
| How do we build the app? | Docker build |
| Where do images go? | AWS ECR |
| Where does the app run? | AWS EKS |
| How do we deploy Kubernetes resources? | Helm |
| How do services get secrets? | GitHub Secrets and Kubernetes Secrets |
| How do we know deployment worked? | Rollout checks and logs |
| How do we recover from failure? | Diagnostics and rollback |

In a real DevOps project, this kind of pipeline is important because it makes deployments repeatable, visible, and safer for the team.
