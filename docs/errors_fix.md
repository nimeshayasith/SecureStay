# Errors Fix Guide

## Overview

During the last two days, this project faced several infrastructure and deployment problems while moving from a local-style setup to an AWS + EKS + Helm + GitHub Actions workflow.

The failures were not caused by a single mistake. They came from a combination of:

- small-cluster resource limits
- image-tag inconsistency between build and deploy stages
- Kubernetes pod scheduling limits
- RabbitMQ deployment timing and service placement issues
- migration-job behavior during repeated failed rollouts
- ingress/public exposure assumptions that did not match the live cluster

This document explains:

- what went wrong
- why the errors happened
- how the issues were solved
- the concepts behind each issue
- what we learned
- what best practices should be followed in future work

---

## Main Problems Faced

The major issues observed during the troubleshooting period were:

1. `ImagePullBackOff`
2. `ErrImagePull`
3. `Too many pods`
4. `aws-cni failed to assign an IP address to container`
5. `context deadline exceeded` on the RabbitMQ Helm release
6. pending pods that never scheduled
7. stale migration jobs from previous failed Helm runs
8. ingress created without a usable public address

These errors looked different, but several of them were connected.

---

## Root Cause Summary

### 1. Image tags were generated twice

Originally, the application pipeline generated a Docker image tag in the build stage and then generated another tag again in the deploy stage.

Because the timestamp changed, Kubernetes tried to deploy an image tag that did not actually exist in ECR.

That caused errors like:

```text
ImagePullBackOff
ErrImagePull
... not found
```

### Why this happens

Docker images are immutable artifacts. Kubernetes can only pull an image if that exact repository and tag already exist in ECR.

If the build job pushes:

```text
securestay/auth-service:20260415085751-eb2de01
```

but the deploy job references:

```text
securestay/auth-service:20260416053029-bf88b28
```

then the deployment fails because the second image was never pushed.

### How it was solved

The pipeline was changed to generate the image tag once in a shared `prepare` job and then reuse that exact tag in both build and deploy stages.

### Concept behind it

This is an example of artifact immutability and deployment consistency.
In CI/CD, the deployment stage must consume the exact artifact produced by the build stage.

### Learning

Never recompute a deploy artifact identifier if it was already created earlier in the pipeline.

---

### 2. EKS worker nodes were too small for the workload

The EKS cluster originally used a very small node-group design. Even after simplifying the app to single replicas, the cluster still struggled with:

- system pods
- RabbitMQ
- the application services
- the migration job during deployment

This caused:

```text
0/2 nodes are available: 2 Too many pods
```

and:

```text
aws-cni failed to assign an IP address to container
```

### Why this happens

In EKS, each node has a limit on how many pods can be scheduled. This is affected by:

- instance type
- ENI/IP limits
- the AWS VPC CNI configuration
- kubelet max pod settings

Even if CPU and memory look acceptable, a node can still reject new pods if it has reached pod-density or IP-allocation limits.

### How it was solved

The infrastructure was redesigned into a more realistic academic profile:

- managed node group remained at 2 nodes
- instance type was changed from `t3.micro` to `t3.small`
- prefix delegation was enabled on the VPC CNI
- app deployments were kept at `replicas: 1`

### Concept behind it

Kubernetes scheduling is not only about CPU and memory. Pod networking capacity also matters.

In AWS EKS, the `aws-cni` plugin allocates IP addresses to pods from the VPC. If the node cannot provide more pod IPs, pods remain pending or fail during sandbox creation.

### Learning

A cluster can fail because of pod-IP limits even when it appears to have enough compute resources.

---

### 3. RabbitMQ Helm release timed out

The infrastructure pipeline repeatedly showed:

```text
module.rabbitmq.helm_release.rabbitmq: context deadline exceeded
```

### Why this happens

A Helm release can time out when the pods created by the chart do not become ready within the configured timeout.

In this case, RabbitMQ was affected by the same cluster-capacity problem:

- pods could not schedule
- pods could not get IPs
- Helm waited for readiness
- Terraform eventually timed out

There was also unnecessary overhead in the earlier RabbitMQ setup for such a small academic environment.

### How it was solved

The RabbitMQ module was simplified:

- `wait = false`
- `wait_for_jobs = false`
- `atomic = false`
- `cleanup_on_fail = false`
- `metrics` disabled
- persistence disabled
- service type set to `ClusterIP`
- CPU and memory requests reduced

This made RabbitMQ lighter and prevented Terraform from hanging too long waiting for conditions that the tiny cluster could not satisfy.

### Concept behind it

Terraform manages the Helm release lifecycle, but Helm readiness still depends on Kubernetes scheduling and health conditions.

A Terraform error on a Helm release often means the real issue is inside Kubernetes, not Terraform syntax.

### Learning

When Terraform says a Helm release timed out, always inspect the actual Kubernetes pod and event state before assuming the Terraform code is wrong.

---

### 4. Duplicate or conflicting deployment assumptions

At one point, the application chart still had assumptions that did not fully match the infrastructure:

- there had been duplicate RabbitMQ responsibility
- ingress existed in the app chart, but there was no working external ingress address
- the app expected public access, but all services were still `ClusterIP`

### Why this happens

In multi-repository systems, infrastructure and application charts can drift apart.
One repo may create a shared service, while the other repo still assumes it should create or expose it differently.

### How it was solved

The responsibilities were made clearer:

- infrastructure repo owns RabbitMQ
- app repo consumes RabbitMQ through `rabbitmq.messaging.svc.cluster.local`
- app repo keeps only the application services
- ingress was disabled by default for the minimal setup
- `api-gateway` was later exposed through a `LoadBalancer` service for public access

### Concept behind it

This is a boundary-definition problem.
Infrastructure code should define platform services.
Application code should deploy workloads that consume those services.

### Learning

Every shared component should have one clear owner.

---

### 5. Migration job behavior created confusion during repeated failures

The database migration job existed as a Helm hook and was useful, but failed rollouts left behind older failed job artifacts.

This made debugging harder because:

- old failed jobs remained visible
- newer runs could appear mixed with older failures
- cluster diagnostics became noisy

### Why this happens

Helm hook jobs are created outside the standard deployment-controller lifecycle. If a hook fails, it can leave history behind depending on the delete policy and failure behavior.

### How it was solved

The migration job was made safer and cleaner:

- kept as a lightweight pre-install job
- old failed jobs were explicitly deleted in the pipeline before redeploy
- rollout diagnostics were improved

### Concept behind it

Hooks are powerful but require cleanup discipline.
Jobs are not the same as Deployments. They have different lifecycle and retry behavior.

### Learning

If using migration jobs in CI/CD, always think about:

- when they run
- how they fail
- how they are cleaned up

---

## Public Exposure Problem

At the end of the successful deployment, the application was still not publicly reachable because:

- the app services were `ClusterIP`
- ingress existed, but there was no working public ingress endpoint

### How it was solved

The simplest academic solution was chosen:

- disable ingress by default
- expose only `api-gateway` as a `LoadBalancer`
- use the AWS load balancer hostname directly

This avoids needing:

- a purchased domain
- a fully configured ingress controller
- extra DNS setup

### Concept behind it

`ClusterIP` is internal-only.
`LoadBalancer` asks the cloud provider to create an external load balancer and public hostname.

### Learning

Public availability in Kubernetes depends on the service exposure model, not only on whether pods are healthy.

---

## What Was Finally Changed

The final stable direction of the project included:

### Infrastructure-side changes

- worker node group made configurable
- production environment moved to `2 x t3.small`
- prefix delegation enabled for the AWS VPC CNI
- RabbitMQ simplified for a lightweight academic deployment
- RabbitMQ kept internal as a `ClusterIP`

### Application-side changes

- image tag generated only once and shared across pipeline jobs
- all services kept at single replica
- RabbitMQ consumed from the `messaging` namespace
- duplicate RabbitMQ deployment removed from the application chart
- deployment cleanup improved before each new rollout
- migration cleanup improved
- public access provided through `api-gateway` `LoadBalancer`
- ingress disabled by default for the minimal deployment path

---

## Concepts Learned From These Problems

### 1. CI/CD artifact consistency

Build once, deploy the exact same artifact.
Do not recompute tags, versions, or release identifiers later in the pipeline.

### 2. Kubernetes scheduling is multi-dimensional

A pod can fail to schedule because of:

- CPU
- memory
- max pods
- node selectors
- taints/tolerations
- persistent volume issues
- networking/IP exhaustion

### 3. Cloud-native networking matters

In EKS, pod creation depends on the AWS CNI.
If pod IP assignment fails, containers do not even start.

### 4. Helm and Terraform are layered tools

Terraform can successfully describe infrastructure code while the real runtime failure still happens inside Kubernetes.

### 5. Simpler architecture is better for academic success

A highly distributed architecture is good for learning, but a minimal deployment profile is better for stability, cost control, and finishing on time.

---

## What I Can Learn From This Experience

This troubleshooting period teaches several important lessons:

### Technical lessons

- small infrastructure decisions can create large deployment problems
- logs must be read as a chain of causes, not as isolated errors
- Kubernetes events are often more useful than only pipeline logs
- public access requires explicit service exposure
- infrastructure and application repositories must stay aligned

### Project lessons

- production-style architecture should be scaled down for student projects
- free-tier-friendly does not always mean EKS-friendly
- finishing a stable working system is better than keeping unnecessary complexity

### Engineering lessons

- make one change at a time
- verify assumptions with real cluster output
- prefer root-cause fixes over repeated retries

---

## Best Practices To Follow Next Time

### CI/CD best practices

- generate build tags once and reuse them
- verify images exist in the registry before deployment
- add preflight checks for cluster readiness and capacity
- print actionable diagnostics on failure

### Kubernetes best practices

- start with `replicas: 1` for academic or low-budget environments
- separate internal services from public entry points
- expose only the minimum required service publicly
- use `LoadBalancer` for the simplest public demo path
- clean up failed jobs and stale rollout artifacts

### Infrastructure best practices

- size nodes for actual pod count, not only for CPU and memory
- treat RabbitMQ and databases as platform dependencies
- simplify optional features like metrics, persistence, and ingress unless they are truly needed
- make node group size and instance type configurable

### Architecture best practices

- assign clear ownership between infra repo and app repo
- keep one source of truth for shared dependencies
- avoid duplicate infrastructure responsibilities across repositories

### Troubleshooting best practices

- use `kubectl get pods`, `kubectl describe pod`, and `kubectl get events` early
- inspect allocatable pod count when pods remain pending
- do not assume Terraform or Helm is the direct cause of every runtime failure
- compare the desired architecture with the real cluster state

---

## Final Reflection

These issues happened because cloud-native systems are layered:

- GitHub Actions builds artifacts
- ECR stores them
- Terraform provisions infrastructure
- Helm creates Kubernetes resources
- Kubernetes schedules pods
- AWS networking provides pod IPs and load balancers

If one layer is slightly inconsistent with another, the final deployment can fail in confusing ways.

The most important success from this troubleshooting period is not only that the pipeline now works. It is that the project was simplified into an architecture that is realistic for an academic environment and much easier to reason about.

That is a strong engineering outcome:

- simpler deployment
- clearer responsibilities
- lower cost
- better reliability
- better understanding of how the system actually works

---

## Suggested Short Conclusion For Report Use

Over the final two days of deployment work, the project encountered several CI/CD, Kubernetes, and AWS infrastructure issues, mainly related to image-tag mismatch, limited EKS node capacity, pod IP exhaustion, Helm release timeouts, and public service exposure. These issues were resolved by redesigning the infrastructure into a lighter academic setup, simplifying RabbitMQ, using a single shared image tag, keeping services at one replica, and exposing the application through a public load balancer. The overall experience highlighted the importance of consistency between build and deploy stages, correct sizing of Kubernetes infrastructure, clear separation of infrastructure and application responsibilities, and reducing complexity when working within academic or budget-constrained environments.
