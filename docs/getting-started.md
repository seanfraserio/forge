# Getting Started with Forge

Forge lets you define AI agents as code. This guide walks you through your first agent deployment.

## Prerequisites

- Node.js 20+
- pnpm 8+

## Install

```bash
npm install -g @forge-ai/cli
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
forge validate
```

## Deploy

```bash
forge deploy --env dev
```

## Check what would change

```bash
forge diff
```

## Next steps

- [forge.yaml Reference](./forge-yaml-reference.md)
- [Core Concepts](./concepts.md)
- [Enterprise Features](./enterprise.md)
