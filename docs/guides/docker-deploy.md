# Docker Deployment

How to deploy Forge agents as Docker containers using the `DockerAdapter`.

---

## Prerequisites

- Docker installed and the Docker daemon running (`docker info` should succeed)
- Node.js 20+
- An API key for your model provider (e.g., `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`)

---

## Configure Docker deployment

The `DockerAdapter` from `@openforge-ai/adapters` builds a Docker image for your agent, runs it as a container, and exposes an HTTP endpoint.

```typescript
import { DockerAdapter } from "@openforge-ai/adapters";

const adapter = new DockerAdapter({
  registry: "us-central1-docker.pkg.dev/my-project/agents",
  push: true,
});

const result = await adapter.deploy(
  { provider: "anthropic", name: "claude-sonnet-4-5-20251001", temperature: 0.7, max_tokens: 4096 },
  { name: "my-agent", systemPrompt: "You are a helpful assistant.", port: 3000 }
);

console.log(result);
// { success: true, containerId: "a1b2c3d4e5f6", imageTag: "registry/my-agent:1234567890", endpoint: "http://localhost:3000" }
```

### Constructor options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `registry` | `string` | `""` | Docker registry URL. If empty, images are built locally only. |
| `runtime` | `string` | `"node:20-alpine"` | Base Docker image for the agent container. |
| `push` | `boolean` | `false` | Whether to push the built image to the registry. |
| `network` | `string` | -- | Docker network to attach the container to. |
| `envVars` | `Record<string, string>` | `{}` | Environment variables injected into the container at runtime. |

---

## What gets built

When you call `adapter.deploy()`, the adapter generates three files in a temporary build context:

1. **`Dockerfile`** -- Based on the configured `runtime` image. Installs production dependencies, copies the agent code, and exposes the configured port.

   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package.json ./
   RUN npm install --production
   COPY . .
   EXPOSE 3000
   CMD ["node", "agent.mjs"]
   ```

2. **`agent.mjs`** -- A generated HTTP server that wraps the model provider SDK. It exposes:
   - `GET /health` -- Returns `{ "status": "ok", "agent": "<name>" }`. Use this for liveness probes.
   - `POST /` -- Accepts `{ "messages": [...] }` and proxies the request to the configured model provider.

3. **`package.json`** -- Declares the provider-specific SDK dependency:
   - `anthropic` provider: `@anthropic-ai/sdk`
   - `openai` provider: `openai`
   - `google` provider: `@google/generative-ai`

The build context is cleaned up after the image is built. If a system prompt is provided, it is written to `system-prompt.txt` and read at container startup.

---

## Deploy to a registry

To push images to a container registry, set `registry` and `push: true`.

### Docker Hub

```typescript
const adapter = new DockerAdapter({
  registry: "docker.io/myorg",
  push: true,
});
```

Authenticate first: `docker login`.

### Google Container Registry / Artifact Registry

```typescript
const adapter = new DockerAdapter({
  registry: "us-central1-docker.pkg.dev/my-project/agents",
  push: true,
});
```

Authenticate first: `gcloud auth configure-docker us-central1-docker.pkg.dev`.

### Amazon ECR

```typescript
const adapter = new DockerAdapter({
  registry: "123456789012.dkr.ecr.us-east-1.amazonaws.com/agents",
  push: true,
});
```

Authenticate first: `aws ecr get-login-password | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com`.

---

## Run on Cloud Run / ECS / Kubernetes

After pushing the image to a registry, deploy to any container platform.

### Google Cloud Run

```bash
gcloud run deploy my-agent \
  --image us-central1-docker.pkg.dev/my-project/agents/my-agent:latest \
  --port 3000 \
  --set-env-vars ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  --allow-unauthenticated
```

### Amazon ECS (Fargate)

```bash
aws ecs create-service \
  --cluster my-cluster \
  --service-name my-agent \
  --task-definition my-agent-task \
  --launch-type FARGATE \
  --desired-count 1
```

Define the task with the pushed image and set `ANTHROPIC_API_KEY` as a secret from AWS Secrets Manager.

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-agent
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-agent
  template:
    metadata:
      labels:
        app: my-agent
    spec:
      containers:
        - name: my-agent
          image: us-central1-docker.pkg.dev/my-project/agents/my-agent:latest
          ports:
            - containerPort: 3000
          env:
            - name: ANTHROPIC_API_KEY
              valueFrom:
                secretKeyRef:
                  name: forge-secrets
                  key: anthropic-api-key
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: my-agent
spec:
  selector:
    app: my-agent
  ports:
    - port: 80
      targetPort: 3000
```

---

## Check agent status

To check whether a deployed agent container is running:

```typescript
const status = await adapter.status("my-agent");
console.log(status);
// { running: true, containerId: "a1b2c3d4e5f6", uptime: "2026-03-17T10:30:00.000Z" }
```

The `status()` method inspects the Docker container by name. If the container does not exist, it returns `{ running: false }`.

---

## View logs

To retrieve recent logs from a running agent container:

```typescript
const logs = await adapter.logs("my-agent");
console.log(logs);
```

By default, `logs()` returns the last 50 lines. To retrieve more:

```typescript
const logs = await adapter.logs("my-agent", 200);
```

---

## Stop and clean up

To stop and remove a deployed agent container:

```typescript
const result = await adapter.destroy("my-agent");
console.log(result);
// { success: true }
```

This runs `docker stop` followed by `docker rm` on the named container. If the container does not exist, it returns `{ success: false, error: "..." }`.

---

## Using with Bastion

To route agent API calls through a [Bastion](https://github.com/seanfraserio/bastion) proxy, set the `ANTHROPIC_BASE_URL` environment variable in the container:

```typescript
const adapter = new DockerAdapter({
  network: "my-network",
  envVars: {
    ANTHROPIC_BASE_URL: "http://bastion:4000",
  },
});

await adapter.deploy(
  { provider: "anthropic", name: "claude-sonnet-4-5-20251001" },
  { name: "my-agent", port: 3000 }
);
```

When `ANTHROPIC_BASE_URL` is set, the Anthropic SDK inside the container sends all requests to the Bastion proxy instead of directly to `api.anthropic.com`. This enables centralized API key management, request logging via Lantern, rate limiting, and cost tracking across all deployed agents.

If both the agent container and the Bastion proxy are on the same Docker network, use the container name as the hostname (e.g., `http://bastion:4000`). If Bastion runs on the host machine, use `http://host.docker.internal:4000`.
