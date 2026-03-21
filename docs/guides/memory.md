# How-to: Configure Memory

Memory determines how your agent retains information across interactions. Forge supports three memory types, each suited to different use cases.

## Memory types

| Type | Behavior | External dependency | Use case |
|------|----------|-------------------|----------|
| `none` | Stateless. Each interaction starts fresh. | None | Simple Q&A, stateless tools, one-shot tasks |
| `in-context` | Conversation history is included in the model's context window. | None | Chatbots, multi-turn conversations, sessions with bounded length |
| `vector` | Conversations and knowledge are persisted to a vector database for retrieval. | Vector database (Chroma, Pinecone, or Weaviate) | Long-running agents, knowledge bases, agents that need recall across sessions |

## Configure stateless memory

If your agent does not need memory, set the type to `none` or omit the `memory` section entirely:

```yaml
memory:
  type: none
```

This is the default behavior. Each interaction is independent with no history carried forward.

## Configure in-context memory

To retain conversation history within the model's context window, set the type to `in-context`:

```yaml
memory:
  type: in-context
```

With in-context memory, previous messages in the conversation are sent to the model on each turn. This works well for multi-turn chat sessions but is limited by the model's context window size. Once the conversation exceeds the context limit, older messages are truncated.

No external services are required. This is the simplest way to give your agent memory.

## Configure vector memory with Chroma

For persistent memory that survives across sessions and scales beyond the context window, use vector memory. This requires a running vector database.

**Step 1: Install and start Chroma.**

```bash
pip install chromadb
chroma run --path ./chroma-data
```

This starts a Chroma server on `localhost:8000` with data stored in `./chroma-data`.

**Step 2: Configure vector memory in `forge.yaml`.**

```yaml
memory:
  type: vector
  provider: chroma
  collection: my-agent-memory
```

- **type** -- Must be `vector`.
- **provider** -- The vector database to use. Supported providers: `chroma`, `pinecone`, `weaviate`.
- **collection** -- The name of the collection (or index) where memories are stored. If it does not exist, it will be created.

**Step 3: Deploy.**

```bash
forgeai deploy
```

Forge will show the memory configuration in the plan:

```
Resources to CREATE:
  + Configure vector memory

Plan: 1 to add, 0 to change, 0 to destroy.
```

**Step 4: Verify Chroma is accessible.**

Confirm that Chroma is running and reachable:

```bash
curl http://localhost:8000/api/v1/heartbeat
```

You should receive a JSON response with a heartbeat timestamp.

### Using Pinecone

To use Pinecone as your vector provider, create an index in the Pinecone console first, then configure:

```yaml
memory:
  type: vector
  provider: pinecone
  collection: my-agent-index
```

Pinecone typically requires an API key set in the environment where the agent runs.

### Using Weaviate

To use Weaviate:

```yaml
memory:
  type: vector
  provider: weaviate
  collection: MyAgentMemory
```

Weaviate can run locally via Docker or as a managed cloud service.

## Memory across deployments

When you redeploy an agent, the behavior of memory depends on the type:

- **none** -- No state to preserve or lose.
- **in-context** -- Conversation history is held in the runtime, not in Forge state. Redeploying does not affect active conversations, but the history is not persisted between agent restarts.
- **vector** -- Data stored in the vector database persists independently of Forge deployments. Redeploying the agent does not delete or modify the vector collection. If you change the `collection` name, the agent starts reading from a new (empty) collection while the old data remains in the database.

Changing the memory `type` in a redeployment (for example, from `in-context` to `vector`) does not migrate data. The agent simply starts using the new memory backend.

## Choose the right memory type

Use the following decision process:

**Start with `none`** if your agent performs independent, stateless tasks (code generation, data transformation, one-shot analysis).

**Move to `in-context`** if your agent needs to remember what was said earlier in the same conversation but does not need to recall information from past sessions.

**Move to `vector`** if any of the following apply:
- The agent needs to recall information from previous sessions.
- Conversations regularly exceed the model's context window.
- The agent needs to search through a knowledge base of accumulated interactions.
- You need memory to persist across agent restarts and redeployments.

You can also use different memory types per environment. For example, use `in-context` for development (no external dependencies) and `vector` for production (full persistence):

```yaml
memory:
  type: in-context

environments:
  production:
    memory:
      type: vector
      provider: chroma
      collection: prod-memory
```

See the [Environments guide](./environments.md) for more on per-environment overrides.
