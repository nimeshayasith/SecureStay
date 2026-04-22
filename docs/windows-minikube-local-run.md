# SecureStay Local Run on Windows with Minikube

Use this guide if you want to run the project on your own Windows machine with Kubernetes and Minikube.

This is a **local development setup only**:

- not AWS
- not Terraform
- not EKS

If you are new to Kubernetes, think of Minikube as a **small local Kubernetes cluster** running on your laptop. It gives you one local Kubernetes node so you can practice deployments, services, pods, and secrets without using the cloud.

What that phrase means in simple words:

- `small` means it is usually just one machine with limited CPU and memory, not a large production setup
- `local` means it runs on your own computer, not on AWS or another cloud provider
- `Kubernetes cluster` means a Kubernetes environment made of nodes that run your containers and manage networking, restarts, and service discovery

In this project, Minikube is basically acting like a tiny practice version of a real Kubernetes environment:

- your laptop is the place where everything runs
- Minikube creates one Kubernetes node
- that node runs your pods such as `frontend`, `gateway`, `auth-service`, and `postgres`
- `kubectl` is the command-line tool you use to talk to that cluster

So when we say "small local Kubernetes cluster", we mean:

"a beginner-friendly Kubernetes environment running on your own machine so you can test and learn locally before using a real cloud cluster."

## 1. What was actually used to run this locally

These are the exact tools used:

- Windows PowerShell
- Docker Desktop
- Minikube with the Docker driver
- `kubectl`

The cluster was started with:

```powershell
& "C:\Program Files\Kubernetes\Minikube\minikube.exe" start --driver=docker
```

Why this command matters:

- `minikube.exe` starts your local Kubernetes cluster
- `--driver=docker` tells Minikube to run the cluster inside Docker Desktop
- this is the easiest option on Windows when Docker Desktop is already installed

## 2. Before you start

Make sure these work first:

```powershell
docker version
kubectl version --client
& "C:\Program Files\Kubernetes\Minikube\minikube.exe" version
```

What these commands do:

- `docker version` confirms Docker Desktop is running
- `kubectl version --client` confirms the Kubernetes CLI is installed
- `minikube version` confirms Minikube is installed

Then go to the project root:

```powershell
cd "C:\Users\nimes\OneDrive\Documents\7 th semester\EC7204 Cloud computing\Project"
```

## 3. Start Minikube

Start the local cluster:

```powershell
& "C:\Program Files\Kubernetes\Minikube\minikube.exe" start --driver=docker
```

Check that it is healthy:

```powershell
& "C:\Program Files\Kubernetes\Minikube\minikube.exe" status
kubectl config current-context
kubectl get nodes
```

What you should see:

- current context should be `minikube`
- a node named `minikube`
- node status should be `Ready`

## 4. Deploy the project into Kubernetes

Apply the Kubernetes files in this order.

Why order matters:

- secrets must exist before the apps read them
- databases and message broker should start before the app services
- frontend and gateway should come later because they depend on the backend

### Step 1: create the secret

```powershell
kubectl apply -f k8s/secrets.yaml
```

This creates the values used by the services, such as:

- database URL
- JWT secret
- RabbitMQ URL
- MongoDB URL

### Step 2: start PostgreSQL, RabbitMQ, and MongoDB

```powershell
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/rabbitmq.yaml
kubectl apply -f k8s/mongodb.yaml
```

Wait until PostgreSQL is ready:

```powershell
kubectl wait --for=condition=ready pod -l app=postgres --timeout=180s
```

Why we wait:

- auth-service, booking-service, and payment-service need the database
- if Postgres is not ready yet, the dependent services may fail on startup

### Step 3: start the application services

```powershell
kubectl apply -f k8s/auth.yaml
kubectl apply -f k8s/booking.yaml
kubectl apply -f k8s/payment.yaml
kubectl apply -f k8s/notification.yaml
kubectl apply -f k8s/gateway.yaml
kubectl apply -f k8s/frontend.yaml
```

## 5. Important local fix that was needed

During the local run, the published image tag `lasindu123/auth-service:1.0` did not start correctly in Minikube.

The fix was to build the auth service image directly from the local source code into Minikube and then restart that deployment.

Build the image into Minikube:

```powershell
& "C:\Program Files\Kubernetes\Minikube\minikube.exe" image build -t lasindu123/auth-service:1.0 services/auth-service
```

Restart the auth deployment:

```powershell
kubectl rollout restart deployment auth-service
```

Why this works:

- the Kubernetes manifest already points to `lasindu123/auth-service:1.0`
- building locally with the same tag lets Minikube use your local image instead of the broken remote one

## 6. Verify that everything is running

Check pods:

```powershell
kubectl get pods
```

You want to see all pods in `Running` state and all containers ready.

Check services:

```powershell
kubectl get services
```

In this project:

- `frontend` is exposed with NodePort `30081`
- `gateway` is exposed with NodePort `30080`

## 7. Open the application in your browser

For **Windows + Minikube using the Docker driver**, the most reliable way to open the app is with `kubectl port-forward`.

Why we use port-forward here:

- the frontend and gateway pods are running correctly inside the cluster
- but the Minikube `NodePort` address may not be directly reachable from Windows when Minikube is running inside Docker
- `port-forward` creates a direct temporary connection from your laptop to the Kubernetes service

Open **PowerShell window 1** and run:

```powershell
kubectl port-forward service/frontend 3001:3000
```

Open **PowerShell window 2** and run:

```powershell
kubectl port-forward service/gateway 4000:4000
```

Then open:

- Frontend: `http://localhost:3001`
- Gateway health: `http://localhost:4000/health`

Important note:

- keep both port-forward terminals open while you are using the app
- if you close those terminals, the forwarded ports stop working

### Alternative method: NodePort

This project also defines NodePorts:

- frontend on `30081`
- gateway on `30080`

You can check the Minikube IP with:

```powershell
& "C:\Program Files\Kubernetes\Minikube\minikube.exe" ip
```

That gives a URL shape like:

- Frontend: `http://<minikube-ip>:30081`
- Gateway health: `http://<minikube-ip>:30080/health`

However, in this Windows local setup, direct NodePort access was not reachable even though the pods were healthy. That is why `kubectl port-forward` is the recommended method in this guide.

## 8. Beginner explanation of what each part is doing

### `kubectl apply -f ...`

This tells Kubernetes:

"Read this YAML file and create or update the resources described inside it."

### `Secret`

A Secret stores values your app needs, such as passwords or connection strings.

In this project, the secret stores:

- Postgres connection string
- JWT secret
- RabbitMQ connection string
- MongoDB connection string

### `Deployment`

A Deployment tells Kubernetes how many copies of a container should be running.

Example:

- auth-service runs 2 replicas
- booking-service runs 2 replicas

If a container crashes, Kubernetes creates a replacement.

### `Service`

A Service gives pods a stable name.

Pods can be recreated and their IP addresses can change, but the Service name stays the same.

Examples in this project:

- `auth-service`
- `booking-service`
- `payment-service`
- `gateway`
- `frontend`

### `NodePort`

A NodePort exposes a Kubernetes service on your Minikube machine.

In theory, that is why you can access:

- frontend on port `30081`
- gateway on port `30080`

But in a **Windows + Minikube + Docker driver** setup, direct NodePort access may still not work from your browser. In that case, use `kubectl port-forward` instead.

## 9. Exact troubleshooting that was needed during the local run

These were the actual problems encountered and the commands used to solve them.

### Problem 1: Minikube failed while pulling its base image

The cluster initially failed because Docker timed out while downloading Minikube's base image from `gcr.io`.

Fix:

```powershell
docker pull gcr.io/k8s-minikube/kicbase:v0.0.50
& "C:\Program Files\Kubernetes\Minikube\minikube.exe" start --driver=docker
```

### Problem 2: the cluster secret still had old AWS-style values

The live secret in Kubernetes had old values from a previous setup, so some services were trying to connect to cloud-style endpoints instead of local ones.

Fix:

```powershell
kubectl apply -f k8s/secrets.yaml
kubectl rollout restart deployment auth-service
kubectl rollout restart deployment booking-service
kubectl rollout restart deployment payment-service
kubectl rollout restart deployment notification-service
```

Why this was necessary:

- `kubectl apply` updates the secret in the cluster
- pods usually need a restart to pick up changed environment values from secrets

### Problem 3: auth-service image needed a local rebuild

The auth deployment crashed with a startup error from the published image.

Fix:

```powershell
& "C:\Program Files\Kubernetes\Minikube\minikube.exe" image build -t lasindu123/auth-service:1.0 services/auth-service
kubectl rollout restart deployment auth-service
```

### Useful debugging commands

```powershell
kubectl get pods
kubectl get services
kubectl describe pod <pod-name>
kubectl logs <pod-name>
kubectl logs <pod-name> --previous
```

Use these when:

- a pod is stuck in `ContainerCreating`
- a pod is in `CrashLoopBackOff`
- a service is not opening in the browser

### Problem 4: frontend URL did not open in the browser

Even though the pods and services were healthy, these URLs were not reachable from Windows:

- `http://192.168.49.2:30081`
- `http://192.168.49.2:30080/health`

The working fix was to use port-forward instead:

```powershell
kubectl port-forward service/frontend 3001:3000
kubectl port-forward service/gateway 4000:4000
```

Then open:

- `http://localhost:3001`
- `http://localhost:4000/health`

## 10. How to stop or reset the local environment

Stop Minikube:

```powershell
& "C:\Program Files\Kubernetes\Minikube\minikube.exe" stop
```

Delete the full local cluster:

```powershell
& "C:\Program Files\Kubernetes\Minikube\minikube.exe" delete
```

Delete only the project resources but keep Minikube:

```powershell
kubectl delete -f k8s/frontend.yaml
kubectl delete -f k8s/gateway.yaml
kubectl delete -f k8s/notification.yaml
kubectl delete -f k8s/payment.yaml
kubectl delete -f k8s/booking.yaml
kubectl delete -f k8s/auth.yaml
kubectl delete -f k8s/mongodb.yaml
kubectl delete -f k8s/rabbitmq.yaml
kubectl delete -f k8s/postgres.yaml
kubectl delete -f k8s/secrets.yaml
```

## 11. Short version if you already understand the basics

```powershell
cd "C:\Users\nimes\OneDrive\Documents\7 th semester\EC7204 Cloud computing\Project"
& "C:\Program Files\Kubernetes\Minikube\minikube.exe" start --driver=docker
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/rabbitmq.yaml
kubectl apply -f k8s/mongodb.yaml
kubectl wait --for=condition=ready pod -l app=postgres --timeout=180s
kubectl apply -f k8s/auth.yaml
kubectl apply -f k8s/booking.yaml
kubectl apply -f k8s/payment.yaml
kubectl apply -f k8s/notification.yaml
kubectl apply -f k8s/gateway.yaml
kubectl apply -f k8s/frontend.yaml
& "C:\Program Files\Kubernetes\Minikube\minikube.exe" image build -t lasindu123/auth-service:1.0 services/auth-service
kubectl rollout restart deployment auth-service
kubectl get pods
kubectl port-forward service/frontend 3001:3000
kubectl port-forward service/gateway 4000:4000
```
