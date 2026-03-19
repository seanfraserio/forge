import type { ModelConfig } from "@openforge-ai/sdk";
import { execFile } from "node:child_process";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import type { RuntimeAdapter, DeployResult, DestroyResult, StatusResult } from "./base.js";

const execFileAsync = promisify(execFile);

/** Validates that a string is safe for use as a Docker name (container, network, image tag component). */
function assertDockerName(value: string, label: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value)) {
    throw new Error(`Invalid ${label}: must match /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/`);
  }
}

/** Validates a Docker image reference (e.g., "node:20-alpine", "registry.io/repo/img:tag"). */
function assertImageRef(value: string): void {
  if (/[\n\r]/.test(value) || !/^[a-zA-Z0-9][a-zA-Z0-9._/:@-]*$/.test(value)) {
    throw new Error(`Invalid image reference: ${value}`);
  }
}

/** Validates environment variable keys. */
function assertEnvKey(key: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
    throw new Error(`Invalid environment variable key: ${key}`);
  }
}

export interface DockerDeployOptions {
  registry?: string;
  runtime?: string;
  push?: boolean;
  network?: string;
  envVars?: Record<string, string>;
}

/**
 * Adapter for deploying agents as Docker containers.
 * Generates a Dockerfile, builds an image, and runs a container.
 */
export class DockerAdapter implements RuntimeAdapter {
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

    // Validate inputs that will be used in shell commands and Dockerfiles
    assertImageRef(this.runtime);
    if (this.registry) assertImageRef(this.registry);
    if (this.network) assertDockerName(this.network, "network name");
    for (const key of Object.keys(this.envVars)) {
      assertEnvKey(key);
    }
  }

  validateModel(_model: ModelConfig): boolean {
    // Docker can run any model — validation depends on the LLM provider, not Docker
    return true;
  }

  async deploy(model: ModelConfig, agentConfig?: {
    name?: string;
    systemPrompt?: string;
    port?: number;
  }): Promise<DeployResult> {
    const agentName = agentConfig?.name ?? "forge-agent";
    assertDockerName(agentName, "agent name");
    const port = agentConfig?.port ?? 3000;
    const tag = `${agentName}:${Date.now()}`;
    const imageRef = this.registry ? `${this.registry}/${tag}` : tag;

    // Create temp build context
    const buildDir = join("/tmp", `forge-docker-${randomUUID()}`);

    try {
      await mkdir(buildDir, { recursive: true });

      // Generate agent runner script
      const runnerScript = this.generateRunnerScript(model, agentConfig);
      await writeFile(join(buildDir, "agent.mjs"), runnerScript);

      // Generate package.json
      const packageJson = {
        name: agentName,
        version: "1.0.0",
        type: "module",
        dependencies: this.getDependencies(model.provider),
      };
      await writeFile(join(buildDir, "package.json"), JSON.stringify(packageJson, null, 2));

      // Generate Dockerfile
      const dockerfile = this.generateDockerfile(port);
      await writeFile(join(buildDir, "Dockerfile"), dockerfile);

      // Write system prompt if provided
      if (agentConfig?.systemPrompt) {
        await writeFile(join(buildDir, "system-prompt.txt"), agentConfig.systemPrompt);
      }

      // Build image
      try {
        await execFileAsync("docker", ["build", "-t", imageRef, "."], {
          cwd: buildDir,
          timeout: 300000,
        });
      } catch (err) {
        return { success: false, error: `Docker build failed: ${(err as Error).message}` };
      }

      // Push if registry configured
      if (this.push && this.registry) {
        try {
          await execFileAsync("docker", ["push", imageRef], { timeout: 120000 });
        } catch (err) {
          return { success: false, error: `Docker push failed: ${(err as Error).message}` };
        }
      }

      // Stop and remove existing container with same name (if any)
      try {
        await execFileAsync("docker", ["rm", "-f", agentName]);
      } catch {
        // Container doesn't exist, that's fine
      }

      // Run container
      const envArgs = Object.entries(this.envVars).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
      const networkArgs = this.network ? ["--network", this.network] : [];

      try {
        const result = await execFileAsync(
          "docker",
          ["run", "-d", "--name", agentName, "-p", `127.0.0.1:${port}:${port}`, ...envArgs, ...networkArgs, imageRef],
          { timeout: 30000 },
        );

        return {
          success: true,
          endpoint: `http://localhost:${port}`,
          metadata: {
            containerId: result.stdout.trim().substring(0, 12),
            imageTag: imageRef,
          },
        };
      } catch (err) {
        return { success: false, error: `Docker run failed: ${(err as Error).message}` };
      }
    } finally {
      // Clean up build context — force: true handles non-existent paths
      await rm(buildDir, { recursive: true, force: true });
    }
  }

  // Stop and remove a deployed container
  async destroy(agentName: string): Promise<DestroyResult> {
    try {
      assertDockerName(agentName, "agent name");
      await execFileAsync("docker", ["rm", "-f", agentName]);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  // Check if a container is running
  async status(agentName: string): Promise<StatusResult> {
    try {
      assertDockerName(agentName, "agent name");
      const result = await execFileAsync(
        "docker",
        ["inspect", "--format", "{{.State.Running}} {{.Id}} {{.State.StartedAt}}", agentName],
      );
      const [running, id, startedAt] = result.stdout.trim().split(" ");
      return {
        active: running === "true",
        status: running === "true" ? "running" : "stopped",
        metadata: {
          containerId: id?.substring(0, 12),
          uptime: startedAt,
        },
      };
    } catch {
      return { active: false, status: "not_found" };
    }
  }

  // Get logs from a running container
  async logs(agentName: string, tail: number = 50): Promise<string> {
    try {
      assertDockerName(agentName, "agent name");
      const result = await execFileAsync("docker", ["logs", "--tail", String(tail), agentName]);
      return result.stdout;
    } catch {
      return "";
    }
  }

  private generateServerBoilerplate(
    agentName: string,
    port: number,
    systemPromptCode: string,
    providerImport: string,
    clientSetup: string,
    apiCall: string,
  ): string {
    return `
${providerImport}
import { createServer } from "node:http";
${systemPromptCode}

${clientSetup}
const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", agent: ${JSON.stringify(agentName)} }));
    return;
  }
  if (req.method !== "POST") { res.writeHead(405); res.end(); return; }
  let body = "";
  req.on("data", c => body += c);
  req.on("end", async () => {
    try {
      const { messages } = JSON.parse(body);
      ${apiCall}
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
  }

  private generateRunnerScript(model: ModelConfig, agentConfig?: { systemPrompt?: string; name?: string; port?: number }): string {
    const port = agentConfig?.port ?? 3000;
    const name = agentConfig?.name ?? "forge-agent";
    const systemPromptCode = agentConfig?.systemPrompt
      ? `import { readFileSync } from "node:fs";\nconst systemPrompt = readFileSync("system-prompt.txt", "utf-8");`
      : `const systemPrompt = "";`;

    if (model.provider === "anthropic") {
      return this.generateServerBoilerplate(
        name,
        port,
        systemPromptCode,
        `import Anthropic from "@anthropic-ai/sdk";`,
        `const client = new Anthropic();`,
        `const response = await client.messages.create({
        model: ${JSON.stringify(model.name)},
        max_tokens: ${model.max_tokens ?? 1024},
        temperature: ${model.temperature ?? 0.7},
        system: systemPrompt || undefined,
        messages,
      });`,
      );
    } else if (model.provider === "openai") {
      return this.generateServerBoilerplate(
        name,
        port,
        systemPromptCode,
        `import OpenAI from "openai";`,
        `const client = new OpenAI();`,
        `const allMessages = systemPrompt
        ? [{ role: "system", content: systemPrompt }, ...messages]
        : messages;
      const response = await client.chat.completions.create({
        model: ${JSON.stringify(model.name)},
        max_tokens: ${model.max_tokens ?? 1024},
        temperature: ${model.temperature ?? 0.7},
        messages: allMessages,
      });`,
      );
    } else {
      return `
import { createServer } from "node:http";
const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", agent: ${JSON.stringify(name)}, provider: ${JSON.stringify(model.provider)} }));
    return;
  }
  res.writeHead(501, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Provider " + ${JSON.stringify(model.provider)} + " runner not yet implemented" }));
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
