# Tutorial: Your First Agent with Forge

## What you'll build

By the end of this tutorial, you'll have a working AI agent defined as code, deployed across two environments, with a full change history. You will learn the core Forge workflow: validate, deploy, diff, and iterate.

## Prerequisites

Before we begin, make sure you have:

- **Node.js 20+** installed (`node --version` to check)
- An **Anthropic API key** (set as `ANTHROPIC_API_KEY` in your shell environment)

## Install Forge

Install the Forge CLI globally:

```bash
npm install -g @openforge-ai/cli
```

Verify the installation:

```bash
forge --version
```

You should see output like:

```
0.1.0
```

If you prefer not to install globally, you can use `npx @openforge-ai/cli` in place of `forge` for any command in this tutorial.

## Create your first agent

We will start by creating a project directory and writing a minimal configuration file.

Create a new directory and navigate into it:

```bash
mkdir hello-forge && cd hello-forge
```

Now create a file called `forge.yaml` with the following contents:

```yaml
version: "1"

agent:
  name: hello-agent
  description: "My first Forge agent"

model:
  provider: anthropic
  name: claude-haiku-4-5-20251001
  temperature: 0.7
  max_tokens: 1024

system_prompt:
  inline: "You are a helpful assistant. Be concise."
```

Notice that the configuration declares everything about the agent in one place: its identity, model, and behavior. This is the "agent as code" approach -- every property is version-controlled and reproducible.

## Validate your config

Before deploying, we will check that the configuration is valid. Run:

```bash
forge validate
```

You'll see:

```
✓ Configuration is valid.
  Agent: hello-agent
  Model: anthropic/claude-haiku-4-5-20251001
```

If there were any problems -- a missing required field, an invalid model provider, a temperature outside the 0-2 range -- Forge would report them here. For example, if you forgot the `model` section entirely, you would see:

```
✗ Validation failed:
  • model: Required
```

## Deploy your agent

Now we will deploy the agent. Run:

```bash
forge deploy
```

Forge reads `forge.yaml`, checks for any existing state, generates a plan, and shows you what will happen:

```
→ Agent: hello-agent | Environment: dev | Model: anthropic/claude-haiku-4-5-20251001

Resources to CREATE:
  + Create agent "hello-agent"
  + Configure model anthropic/claude-haiku-4-5-20251001
  + Set system prompt from inline

Plan: 3 to add, 0 to change, 0 to destroy.

Do you want to apply these changes?
  Use --auto-approve to skip this prompt.

✓ Successfully deployed "hello-agent" to dev
  State written to .forge/state.json
  Config hash: a1b2c3d4e5f6...
```

Notice the `+` prefix on each line -- this means the resource is being created for the first time. Forge follows a plan/apply cycle inspired by Terraform: it shows you exactly what will change before making any modifications.

After the deploy completes, Forge writes a state file. Take a look at it:

```bash
cat .forge/state.json
```

You'll see something like:

```json
{
  "configHash": "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
  "lastDeployed": "2026-03-17T14:30:00.000Z",
  "environment": "dev",
  "agentName": "hello-agent",
  "config": {
    "version": "1",
    "agent": {
      "name": "hello-agent",
      "description": "My first Forge agent"
    },
    "model": {
      "provider": "anthropic",
      "name": "claude-haiku-4-5-20251001",
      "temperature": 0.7,
      "max_tokens": 1024
    },
    "system_prompt": {
      "inline": "You are a helpful assistant. Be concise."
    }
  }
}
```

This state file records exactly what was deployed, when, and to which environment. Forge uses it on the next deploy to compute a diff. Add `.forge/` to your `.gitignore` -- state is local to each deployment target.

If you run `forge deploy` again without changing anything, Forge detects that the config hash matches and reports:

```
No changes. Infrastructure is up to date.
  Agent "hello-agent" is up to date (hash: a1b2c3d4)
```

This is idempotency in action. Deploying the same config twice is always safe.

## Make a change

We will now modify the agent's temperature to make responses more deterministic. Open `forge.yaml` and change `temperature` from `0.7` to `0.3`:

```yaml
model:
  provider: anthropic
  name: claude-haiku-4-5-20251001
  temperature: 0.3
  max_tokens: 1024
```

Before deploying, preview what would change using the `diff` command:

```bash
forge diff
```

You'll see:

```
~ Change temperature: 0.7 → 0.3
  - 0.7
  + 0.3
```

Notice the `~` prefix -- this indicates an update to an existing resource, not a new creation. The diff shows the old value and the new value so you can review the change before committing to it.

## Deploy the change

Now apply the change:

```bash
forge deploy
```

```
→ Agent: hello-agent | Environment: dev | Model: anthropic/claude-haiku-4-5-20251001

Resources to UPDATE:
  ~ Change temperature: 0.7 → 0.3

Plan: 0 to add, 1 to change, 0 to destroy.

Do you want to apply these changes?
  Use --auto-approve to skip this prompt.

✓ Successfully deployed "hello-agent" to dev
  State written to .forge/state.json
  Config hash: f6e5d4c3b2a1...
```

The state file is updated with the new config hash. Every deployment is tracked, giving you a full history of changes.

## Add a system prompt file

Inline prompts are convenient for getting started, but real-world agents need longer, more detailed system prompts. We will move the prompt to its own file.

Create a `prompts` directory and a system prompt file:

```bash
mkdir prompts
```

Create `prompts/system.md` with the following content:

```markdown
You are a helpful assistant built with Forge.

## Guidelines

- Be concise and direct in your responses.
- When you don't know something, say so.
- Use markdown formatting when it improves readability.
- Always cite sources when making factual claims.
```

Now update `forge.yaml` to reference the file instead of the inline prompt:

```yaml
system_prompt:
  file: ./prompts/system.md
```

Remove (or replace) the `inline:` line entirely. The `system_prompt` section accepts either `file` or `inline`, but not both.

Deploy the change:

```bash
forge deploy
```

```
→ Agent: hello-agent | Environment: dev | Model: anthropic/claude-haiku-4-5-20251001

Resources to UPDATE:
  ~ Update system prompt

Plan: 0 to add, 1 to change, 0 to destroy.

✓ Successfully deployed "hello-agent" to dev
  State written to .forge/state.json
  Config hash: 9a8b7c6d5e4f...
```

Now your system prompt lives in a separate file that you can edit, review, and version-control independently from the agent configuration.

## Add environments

In practice, you want different settings for development and production. We will add two environments: `dev` uses a cheaper, faster model; `production` uses a more capable model with a lower temperature for consistency.

Update `forge.yaml` to add an `environments` section:

```yaml
version: "1"

agent:
  name: hello-agent
  description: "My first Forge agent"

model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
  temperature: 0.5
  max_tokens: 4096

system_prompt:
  file: ./prompts/system.md

environments:
  dev:
    model:
      name: claude-haiku-4-5-20251001
      temperature: 0.7
      max_tokens: 1024
  production:
    model:
      name: claude-sonnet-4-5-20251001
      temperature: 0.1
      max_tokens: 8192
```

Notice that each environment only overrides the fields it needs to change. The `dev` environment uses the smaller Haiku model for faster iteration. The `production` environment keeps Sonnet but lowers the temperature and increases the token limit.

Deploy to the dev environment (this is the default):

```bash
forge deploy
```

```
→ Agent: hello-agent | Environment: dev | Model: anthropic/claude-haiku-4-5-20251001

Resources to UPDATE:
  ~ Change temperature: 0.3 → 0.7
  ~ Change max_tokens: 1024 → 1024

Plan: 0 to add, 1 to change, 0 to destroy.

✓ Successfully deployed "hello-agent" to dev
```

Now deploy to production:

```bash
forge deploy --env production
```

```
→ Agent: hello-agent | Environment: production | Model: anthropic/claude-sonnet-4-5-20251001

Resources to CREATE:
  + Create agent "hello-agent"
  + Configure model anthropic/claude-sonnet-4-5-20251001
  + Set system prompt from ./prompts/system.md

Plan: 3 to add, 0 to change, 0 to destroy.

✓ Successfully deployed "hello-agent" to production
```

Notice that production shows CREATE operations because it has never been deployed to that environment before. Each environment has its own state.

You can also preview what would change in a specific environment without deploying:

```bash
forge diff --env production
```

## Add an MCP server

MCP (Model Context Protocol) servers give your agent tools -- capabilities like reading files, searching the web, or calling APIs. We will add a filesystem server so the agent can read and write files in a `./data` directory.

Add a `tools` section to `forge.yaml`:

```yaml
version: "1"

agent:
  name: hello-agent
  description: "My first Forge agent"

model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
  temperature: 0.5
  max_tokens: 4096

system_prompt:
  file: ./prompts/system.md

tools:
  mcp_servers:
    - name: filesystem
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "./data"]

environments:
  dev:
    model:
      name: claude-haiku-4-5-20251001
      temperature: 0.7
      max_tokens: 1024
  production:
    model:
      name: claude-sonnet-4-5-20251001
      temperature: 0.1
      max_tokens: 8192
```

Create the data directory so the MCP server has something to work with:

```bash
mkdir -p data
```

Deploy the change:

```bash
forge deploy
```

```
→ Agent: hello-agent | Environment: dev | Model: anthropic/claude-haiku-4-5-20251001

Resources to CREATE:
  + Add MCP server "filesystem"

Plan: 1 to add, 0 to change, 0 to destroy.

✓ Successfully deployed "hello-agent" to dev
```

The MCP server is now part of your agent's configuration. When the agent runs, it will have access to file operations within the `./data` directory. See the [MCP Servers guide](./guides/mcp-servers.md) for more details on configuring servers with environment variables and using multiple servers.

## What you've learned

In this tutorial, you walked through the complete Forge workflow:

1. **Validate** -- `forge validate` checks your configuration for errors before you deploy.
2. **Deploy** -- `forge deploy` computes a plan, shows you what will change, and applies it. State is tracked in `.forge/state.json`.
3. **Diff** -- `forge diff` previews changes without applying them. Use it to review before deploying.
4. **Environments** -- The `environments` section lets you override model settings per deployment target. Deploy with `--env` to target a specific environment.
5. **Tools** -- MCP servers give your agent capabilities. Declare them in the `tools` section of `forge.yaml`.

Every change follows the same cycle: edit `forge.yaml`, run `forge diff` to review, run `forge deploy` to apply. The process is idempotent and auditable.

## Next steps

- [MCP Servers guide](./guides/mcp-servers.md) -- Configure tools, environment variables, and multiple servers
- [Environments guide](./guides/environments.md) -- Advanced environment strategies and CI/CD
- [Memory guide](./guides/memory.md) -- Add conversation history and vector memory
- [forge.yaml Reference](./forge-yaml-reference.md) -- Complete field reference
- [Core Concepts](./concepts.md) -- Deeper understanding of plan/apply, state, and idempotency
