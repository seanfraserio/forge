# How-to: Configure MCP Servers

MCP (Model Context Protocol) servers are external processes that give your agent tools -- capabilities like reading files, searching the web, querying databases, or calling APIs.

## Add an MCP server

To add an MCP server, define it in the `tools.mcp_servers` list in your `forge.yaml`. Each server requires a `name` and `command`. Optionally, provide `args` and `env`.

```yaml
tools:
  mcp_servers:
    - name: filesystem
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "./data"]
```

- **name** -- A unique identifier for this server (lowercase, used in plan output and state tracking).
- **command** -- The executable to run (e.g., `npx`, `node`, `python`).
- **args** -- An array of command-line arguments passed to the command.

After adding a server, run `forge deploy` to apply the change. Forge will show `+ Add MCP server "filesystem"` in the plan output.

## Pass environment variables

If your MCP server requires API keys or other secrets, use the `env` section. Reference shell environment variables with the `${VAR}` syntax:

```yaml
tools:
  mcp_servers:
    - name: brave-search
      command: npx
      args: ["-y", "@anthropic/mcp-server-brave-search"]
      env:
        BRAVE_API_KEY: "${BRAVE_API_KEY}"
```

At deploy time, Forge records the `${BRAVE_API_KEY}` template reference in state rather than the resolved value. This keeps secrets out of `.forge/state.json`. However, the actual environment variable must be set in your shell when the agent runs.

To set the variable before deploying:

```bash
export BRAVE_API_KEY="your-api-key-here"
forge deploy
```

## Configure multiple servers

To give your agent multiple tools, add more entries to the `mcp_servers` list:

```yaml
tools:
  mcp_servers:
    - name: filesystem
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "./data"]

    - name: brave-search
      command: npx
      args: ["-y", "@anthropic/mcp-server-brave-search"]
      env:
        BRAVE_API_KEY: "${BRAVE_API_KEY}"

    - name: github
      command: npx
      args: ["-y", "@modelcontextprotocol/server-github"]
      env:
        GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}"
```

Each server runs as a separate process. There is no limit to the number of servers you can configure, though each one adds startup overhead.

When you add or remove a server, Forge tracks the change individually. For example, if you add the `github` server to an existing configuration that already has `filesystem` and `brave-search`, the plan output will show:

```
Resources to CREATE:
  + Add MCP server "github"

Plan: 1 to add, 0 to change, 0 to destroy.
```

If you modify a server's `args` or `env`, Forge shows an update:

```
Resources to UPDATE:
  ~ Update MCP server "brave-search"
```

If you remove a server entirely, Forge shows a deletion:

```
Resources to DELETE:
  - Remove MCP server "github"
```

## Common MCP servers

The following table lists popular MCP servers and their configurations:

| Server | npm Package | Description |
|--------|------------|-------------|
| Filesystem | `@modelcontextprotocol/server-filesystem` | Read and write files in a specified directory |
| Brave Search | `@anthropic/mcp-server-brave-search` | Web search via the Brave Search API |
| GitHub | `@modelcontextprotocol/server-github` | Interact with GitHub repositories, issues, and PRs |
| Slack | `@anthropic/mcp-server-slack` | Send and read messages in Slack workspaces |
| PostgreSQL | `@modelcontextprotocol/server-postgres` | Query PostgreSQL databases |

**Filesystem** -- no API key required, takes a directory path as an argument:

```yaml
- name: filesystem
  command: npx
  args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]
```

**Brave Search** -- requires a `BRAVE_API_KEY`:

```yaml
- name: brave-search
  command: npx
  args: ["-y", "@anthropic/mcp-server-brave-search"]
  env:
    BRAVE_API_KEY: "${BRAVE_API_KEY}"
```

**GitHub** -- requires a personal access token:

```yaml
- name: github
  command: npx
  args: ["-y", "@modelcontextprotocol/server-github"]
  env:
    GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}"
```

**Slack** -- requires a bot token and optionally a team ID:

```yaml
- name: slack
  command: npx
  args: ["-y", "@anthropic/mcp-server-slack"]
  env:
    SLACK_BOT_TOKEN: "${SLACK_BOT_TOKEN}"
    SLACK_TEAM_ID: "${SLACK_TEAM_ID}"
```

## Test your MCP server locally

Before deploying, verify that the MCP server command starts correctly. Run the command directly in your terminal:

```bash
npx -y @modelcontextprotocol/server-filesystem ./data
```

If the server starts without errors, it will wait for input on stdin (this is expected -- MCP servers communicate over stdio). Press `Ctrl+C` to stop it.

For servers that require environment variables, set them first:

```bash
export BRAVE_API_KEY="your-key"
npx -y @anthropic/mcp-server-brave-search
```

If the command fails, resolve the issue before adding it to `forge.yaml`. Common problems include missing npm packages (the `-y` flag in npx auto-installs) and missing environment variables.

## Troubleshooting

**"command not found" or npx fails to install the package**

Ensure Node.js 20+ is installed and npx is available in your PATH. If you are behind a corporate proxy, configure npm's proxy settings:

```bash
npm config set proxy http://proxy.example.com:8080
```

**"Environment variable not set"**

If the MCP server fails because an environment variable is missing, make sure you have exported it in your current shell session. The `${VAR}` syntax in `forge.yaml` tells the server to read from the shell environment at runtime. Forge does not resolve these values itself at deploy time.

```bash
export BRAVE_API_KEY="your-key"
forge deploy
```

**Server starts but the agent cannot use its tools**

Ensure the `name` field in your MCP server config is unique across all servers. If two servers share the same name, Forge will treat them as the same server and one will overwrite the other.

**MCP server works locally but not after deploy**

Check that the deployment environment has the same Node.js version and network access as your local machine. MCP servers that depend on external APIs (Brave Search, GitHub) require network connectivity from the runtime environment.
