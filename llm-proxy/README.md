# AI Proxy

A lightweight proxy server that injects auth keys, lists models from multiple providers, logs sessions by ID, and handles HTTP/SSE streaming.

## Setup

```bash
npm install
```

## Configuration

Define your providers in `providers.json`:

```json
{
  "anthropic": {
    "baseUrl": "https://api.anthropic.com"
  },
  "openai": {
    "baseUrl": "https://api.openai.com/v1",
    "authToken": "sk-..."
  },
  "my-provider": {
    "baseUrl": "https://api.example.com",
    "authToken": "your-token"
  }
}
```

Each provider supports:
- `baseUrl` — upstream API base URL
- `authToken` — (optional) Bearer token, overrides any client-sent auth

## Start

```bash
npm start
# or
PORT=8080 npm start
```

Defaults to port 3000.

## Routes

### Direct proxy

Route requests to a specific provider by name:

```
POST /proxy/:provider/v1/messages
POST /proxy/:provider/v1/messages/count_tokens
POST /proxy/:provider/v1/chat/completions
GET  /proxy/:provider/v1/models
```

Example:
```bash
curl http://localhost:3000/proxy/anthropic/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-4-20250514", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 1024}'
```

### Auto routing

Use the `/auto` prefix with a `provider/model` format in the model field. The proxy extracts the provider, strips the prefix, and forwards the request:

```
POST /auto/v1/messages
POST /auto/v1/messages/count_tokens
POST /auto/v1/chat/completions
GET  /auto/v1/models
```

Example:
```bash
curl http://localhost:3000/auto/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"model": "anthropic/claude-sonnet-4-20250514", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 1024}'
```

`GET /auto/v1/models` returns models from all providers with prefixed IDs (e.g. `anthropic/claude-sonnet-4-20250514`).

### Other endpoints

```
GET /models   — fetch models from all providers (grouped by provider)
GET /health   — health check
```

## Session logging

For requests to `messages` endpoints, the proxy logs the full conversation per session to `logs/<session-id>.json`. The session ID is extracted from `metadata.user_id` in the request body (matching `_session_<id>`).

Each log file contains the complete message history (request messages + parsed assistant response) and is overwritten on every request since the request body already carries the full conversation.

## Response streaming

All responses are piped through as raw streams, preserving SSE streaming for tools like Claude Code and IntelliJ ACP.
