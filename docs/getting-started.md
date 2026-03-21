# Getting Started with Forge

Forge lets you define AI agents as code. This guide walks you through your first agent deployment.

## Prerequisites

- Node.js 20+

## Install

Choose one of the following methods:

**npm** (global install):
```bash
npm install -g @openforge-ai/cli
```

**npx** (no install, run directly):
```bash
npx @openforge-ai/cli validate
```

**Homebrew** (macOS/Linux):
```bash
brew tap seanfraserio/tap
brew install forgeai
```

Verify the installation:
```bash
forgeai --version
```

## Create your first agent

Create a `forge.yaml` file:

```yaml
version: "1"

agent:
  name: my-first-agent
  description: "A simple assistant"

model:
  provider: anthropic
  name: claude-sonnet-4-5-20251001
  temperature: 0.7
  max_tokens: 4096

system_prompt:
  inline: "You are a helpful assistant."

memory:
  type: none
```

## Validate

```bash
forgeai validate
```

## Deploy

```bash
forgeai deploy --env dev
```

## Check what would change

```bash
forgeai diff
```

## Next steps

- [forge.yaml Reference](./forge-yaml-reference.md)
- [Core Concepts](./concepts.md)
- [Enterprise Features](./enterprise.md)
