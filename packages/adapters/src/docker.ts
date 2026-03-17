import type { ModelConfig } from "@openforge-ai/sdk";
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export interface DockerDeployOptions {
  registry?: string;
  runtime?: string;
  push?: boolean;
  network?: string;
  envVars?: Record<string, string>;
}

export interface DockerDeployResult {
  success: boolean;
  endpoint?: string;
  containerId?: string;
  imageTag?: string;
  error?: string;
}

/**
 * Adapter for deploying agents as Docker containers.
 * Generates a Dockerfile, builds an image, and runs a container.
 */
export class DockerAdapter {
  private registry: string;
  private runtime: string;
  private push: boolean;
  private network?: string;
  private envVars: Record<string, string>;

  constructor(options: DockerDeployOptions = {}) {
    this.registry = options.registry ?? "";
    this.runtime = options.runtime ?? "node:20-alpine";
    this.push = options.push ?? false;
    this.network = options.network;
    this.envVars = options.envVars ?? {};
  }

  validateModel(_model: ModelConfig): boolean {
    // Docker can run any model — validation depends on the LLM provider, not Docker
    return true;
  }

  async deploy(model: ModelConfig, agentConfig?: {
    name?: string;
    systemPrompt?: string;
    port?: number;
  }): Promise<DockerDeployResult> {
    const agentName = agentConfig?.name ?? "forge-agent";
    const port = agentConfig?.port ?? 3000;
    const tag = `${agentName}:${Date.now()}`;
    const imageRef = this.registry ? `${this.registry}/${tag}` : tag;

    // Create temp build context
    const buildDir = join("/tmp", `forge-docker-${randomUUID()}`);

    try {
      mkdirSync(buildDir, { recursive: true });

      // Generate agent runner script
      const runnerScript = this.generateRunnerScript(model, agentConfig);
      writeFileSync(join(buildDir, "agent.mjs"), runnerScript);

      // Generate package.json
      const packageJson = {
        name: agentName,
        version: "1.0.0",
        type: "module",
        dependencies: this.getDependencies(model.provider),
      };
      writeFileSync(join(buildDir, "package.json"), JSON.stringify(packageJson, null, 2));

      // Generate Dockerfile
      const dockerfile = this.generateDockerfile(port);
      writeFileSync(join(buildDir, "Dockerfile"), dockerfile);

      // Write system prompt if provided
      if (agentConfig?.systemPrompt) {
        writeFileSync(join(buildDir, "system-prompt.txt"), agentConfig.systemPrompt);
      }

      // Build image
      try {
        execSync(`docker build -t ${imageRef} .`, {
          cwd: buildDir,
          stdio: "pipe",
          timeout: 300000,
        });
      } catch (err) {
        return { success: false, error: `Docker build failed: ${(err as Error).message}` };
      }

      // Push if registry configured
      if (this.push && this.registry) {
        try {
          execSync(`docker push ${imageRef}`, { stdio: "pipe", timeout: 120000 });
        } catch (err) {
          return { success: false, error: `Docker push failed: ${(err as Error).message}` };
        }
      }

      // Stop existing container with same name (if any)
      try {
        execSync(`docker stop ${agentName} && docker rm ${agentName}`, { stdio: "pipe" });
      } catch {
        // Container doesn't exist, that's fine
      }

      // Run container
      const envFlags = Object.entries(this.envVars)
        .map(([k, v]) => `-e ${k}=${v}`)
        .join(" ");
      const networkFlag = this.network ? `--network ${this.network}` : "";

      try {
        const result = execSync(
          `docker run -d --name ${agentName} -p ${port}:${port} ${envFlags} ${networkFlag} ${imageRef}`,
          { stdio: "pipe", timeout: 30000 }
        ).toString().trim();

        return {
          success: true,
          containerId: result.substring(0, 12),
          imageTag: imageRef,
          endpoint: `http://localhost:${port}`,
        };
      } catch (err) {
        return { success: false, error: `Docker run failed: ${(err as Error).message}` };
      }
    } finally {
      // Clean up build context
      if (existsSync(buildDir)) {
        rmSync(buildDir, { recursive: true, force: true });
      }
    }
  }

  // Stop and remove a deployed container
  async destroy(agentName: string): Promise<{ success: boolean; error?: string }> {
    try {
      execSync(`docker stop ${agentName} && docker rm ${agentName}`, { stdio: "pipe" });
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  // Check if a container is running
  async status(agentName: string): Promise<{ running: boolean; containerId?: string; uptime?: string }> {
    try {
      const result = execSync(
        `docker inspect --format='{{.State.Running}} {{.Id}} {{.State.StartedAt}}' ${agentName}`,
        { stdio: "pipe" }
      ).toString().trim();
      const [running, id, startedAt] = result.split(" ");
      return { running: running === "true", containerId: id?.substring(0, 12), uptime: startedAt };
    } catch {
      return { running: false };
    }
  }

  // Get logs from a running container
  async logs(agentName: string, tail: number = 50): Promise<string> {
    try {
      return execSync(`docker logs --tail ${tail} ${agentName}`, { stdio: "pipe" }).toString();
    } catch {
      return "";
    }
  }

  private generateRunnerScript(model: ModelConfig, agentConfig?: { systemPrompt?: string; name?: string; port?: number }): string {
    const port = agentConfig?.port ?? 3000;
    const name = agentConfig?.name ?? "forge-agent";
    const systemPromptCode = agentConfig?.systemPrompt
      ? `import { readFileSync } from "node:fs";\nconst systemPrompt = readFileSync("system-prompt.txt", "utf-8");`
      : `const systemPrompt = "";`;

    if (model.provider === "anthropic") {
      return `
import Anthropic from "@anthropic-ai/sdk";
import { createServer } from "node:http";
${systemPromptCode}

const client = new Anthropic();
const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", agent: "${name}" }));
    return;
  }
  if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
  let body = "";
  req.on("data", c => body += c);
  req.on("end", async () => {
    try {
      const { messages } = JSON.parse(body);
      const response = await client.messages.create({
        model: "${model.name}",
        max_tokens: ${model.max_tokens ?? 1024},
        temperature: ${model.temperature ?? 0.7},
        system: systemPrompt || undefined,
        messages,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});
server.listen(${port}, "0.0.0.0", () => {
  console.log("Forge agent running on port ${port}");
});
`;
    } else if (model.provider === "openai") {
      return `
import OpenAI from "openai";
import { createServer } from "node:http";
${systemPromptCode}

const client = new OpenAI();
const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", agent: "${name}" }));
    return;
  }
  if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
  let body = "";
  req.on("data", c => body += c);
  req.on("end", async () => {
    try {
      const { messages } = JSON.parse(body);
      const allMessages = systemPrompt
        ? [{ role: "system", content: systemPrompt }, ...messages]
        : messages;
      const response = await client.chat.completions.create({
        model: "${model.name}",
        max_tokens: ${model.max_tokens ?? 1024},
        temperature: ${model.temperature ?? 0.7},
        messages: allMessages,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});
server.listen(${port}, "0.0.0.0", () => {
  console.log("Forge agent running on port ${port}");
});
`;
    } else {
      return `
import { createServer } from "node:http";
const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", agent: "${name}", provider: "${model.provider}" }));
    return;
  }
  res.writeHead(501, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Provider '${model.provider}' runner not yet implemented" }));
});
server.listen(${port}, "0.0.0.0", () => {
  console.log("Forge agent running on port ${port}");
});
`;
    }
  }

  private generateDockerfile(port: number): string {
    return `FROM ${this.runtime}
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY . .
EXPOSE ${port}
CMD ["node", "agent.mjs"]
`;
  }

  private getDependencies(provider: string): Record<string, string> {
    switch (provider) {
      case "anthropic":
        return { "@anthropic-ai/sdk": "^0.39.0" };
      case "openai":
        return { "openai": "^4.77.0" };
      case "google":
        return { "@google/generative-ai": "^0.21.0" };
      default:
        return {};
    }
  }
}
