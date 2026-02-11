# Junie CLI HTTP API Documentation

*Created: 2026-01-15*

This document contains the extracted HTTP configuration and API endpoints for the Junie CLI tool.

## ⚡ WORKING HTTP CALLS (TESTED)

Test endpoints

```python
   python3 test_chat_api.py
```

Based on actual testing, here are the **confirmed working** API endpoints and formats:

### 1. Simple Chat - OpenAI Mini (Root Endpoint)
```bash
curl -X POST "https://ingrazzio-for-junie-cloud-prod.labs.jb.gg/" \
  -H "Authorization: Bearer <perm-token>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-LLM-Model: openai" \
  -d '{
    "model": "gpt-4.1-mini-2025-04-14",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant. Respond briefly."},
      {"role": "user", "content": "Say '"'Hello World'"' in JSON format with a '"'message'"' field."}
    ],
    "temperature": 0.0,
    "stream": false
  }'
```

### 2. Anthropic - Root Endpoint
```bash
curl -X POST "https://ingrazzio-for-junie-cloud-prod.labs.jb.gg/" \
  -H "Authorization: Bearer <perm-token>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "User-Agent: ktor-client" \
  -H "X-LLM-Model: anthropic" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "messages": [
      {"role": "user", "content": "Say '"'Hello World'"' - keep it brief!"}
    ],
    "max_tokens": 100
  }'
```

### 3. Grok - v1/responses
```bash
curl -X POST "https://ingrazzio-for-junie-cloud-prod.labs.jb.gg/v1/responses" \
  -H "Authorization: Bearer <perm-token>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "User-Agent: ktor-client" \
  -H "Openai-Version: 2020-11-07" \
  -H "X-Keep-Path: true" \
  -H "X-LLM-Model: grok" \
  -d '{
    "model": "grok-4-1-fast-reasoning",
    "input": [
      {"role": "system", "content": "You are a helpful assistant. Respond very briefly."},
      {"role": "user", "content": "Say '"'Hello World'"'"}
    ],
    "tools": [],
    "include": [],
    "truncation": "auto",
    "parallel_tool_calls": false,
    "stream": false,
    "text": {},
    "store": false
  }'
```

### Key Differences from Standard OpenAI API
| Standard OpenAI | **Junie API** |
|-----------------|---------------|
| `/v1/chat/completions` | `/v1/responses` or `/` (root) |
| `messages` | `input` (for `/v1/responses`) |
| `Authorization` only | + `Openai-Version`, `X-Keep-Path`, `X-LLM-Model` |

### Known Models (Tested Working)

| Model | Provider | Endpoint |
|-------|----------|----------|
| `gpt-4.1-mini-2025-04-14` | OpenAI | Root `/` with `X-LLM-Model: openai` |
| `claude-sonnet-4-5-20250929` | Anthropic | Root `/` with `X-LLM-Model: anthropic` |
| `grok-4-1-fast-reasoning` | Grok/xAI | `/v1/responses` with `X-LLM-Model: grok` |


---

## Base URLs

| Environment | URL | Status |
|-------------|-----|--------|
| **Working** | `https://ingrazzio-for-junie-cloud-prod.labs.jb.gg` | ✅ **CONFIRMED** |
| Alternative | `https://ingrazzio-junie-prod.labs.jb.gg` | ❌ Not working |

## Authentication

- **Type**: Bearer Token
- **Header Format**: `Authorization: Bearer <token>`
- **Token Source**: Environment Variable `INGRAZZIO_ACCESS_TOKEN`

### Example Header
```
Authorization: Bearer sk-your-token-here
```

## Authentication (✅ CONFIRMED WORKING)

### Authorization Method

The authentication is simple and straightforward:
- **Header**: `Authorization: Bearer <perm-token>`
- **URL**: `https://ingrazzio-for-junie-cloud-prod.labs.jb.gg`
- **Token**: Use your perm-token directly (no transformation needed!)

### Example Command

```bash
# Note: Returns 400 due to request format, NOT 401 (unauthorized)
curl -i -X POST "https://ingrazzio-for-junie-cloud-prod.labs.jb.gg/llm/openai/v1/chat/completions" \
  -H "Authorization: Bearer perm-XXX" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4.1-mini-2025-04-14","messages":[{"role":"user","content":"Hello"}]}'
```

**Status**: ✅ **Authentication confirmed working!** (400 = request format issue, NOT auth failure)

### Token Types

| Token Type | Format | Purpose |
|------------|--------|---------|
| **License Token** | `perm-<base64>.<base64>.<base64>` | JetBrains license token, obtained from JetBrains website |
| **JWT/API Token** | Standard JWT | Required for all API calls (format still unknown) |

### Current Status

⚠️ **Authentication method is NOT working yet.** The following has been discovered through bytecode analysis:

1. **Discovered Authentication Classes:**
   - `JunieAuthUtil.generateP256()` - Generates ECDSA P-256 key pairs locally
   - `JunieAuthUtil.issueJwt()` - Creates JWT with ES256 (ECDSA SHA-256), 60s expiry
   - `JunieAuthData.withAuth()` - Sets `Authorization: Bearer <JWT>` header
   - `V5Headers.append()` - Sets `Grazie-Authenticate-JWT: <token>` header
   - `IngrazzioAccessToken` - Manages different token types (GitHub, Matterhorn, JBA, Kineto)

2. **JWT Structure (from `JunieAuthUtil.issueJwt()`):**
   ```
   {
     "iss": "ide",
     "sub": "ide-instance-123",  // placeholder?
     "aud": "your-server",       // placeholder?
     "iat": <now>,
     "exp": <now + 60s>,
     "jti": <random UUID>
   }
   ```

3. **Discovered Endpoints:**
   - `/auth/ls/provide-access` - Takes `{ticket, sign}` → returns `{token}`
   - `/auth/jetbrains-jwt/register` - Register license token
   - `/auth/jwt/refresh` - Refresh JWT token

4. **Attempted Methods (NOT WORKING):**
   - `Authorization: Bearer perm-...` → **401 "invalid_token"**
   - `Grazie-Authenticate-JWT: perm-...` → **401**
   - `Authorization: Matterhorn perm-...` → **401**
   - `/auth/ls/provide-access` with `{ticket: "perm-...", sign: ""}` → **401**

5. **CLI Successfully Makes Requests:**
   - Logs confirm successful API calls to `ingrazzio-junie-prod.labs.jb.gg`
   - Uses the perm-token stored in `~/.junie/secure_credentials.json`
   - The exact authentication mechanism is still unknown

### Auth Flow Diagram (Preliminary)

```
┌─────────────────┐
│  License Token  │
│   (perm-*)       │  ← Stored in ~/.junie/secure_credentials.json
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  ??? (UNKNOWN METHOD)           │  ← CLI internal transformation
│  - Local JWT generation?         │
│  - Token exchange?               │
│  - Signature verification?       │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│   JWT Token     │  ← Actual token used in Authorization header
│  (format ???)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API Calls      │  ← Successful requests observed in CLI logs
│  /llm/...       │
└─────────────────┘
```

### Attempted Authentication Methods (NOT WORKING)

#### Attempt 1: Using perm-token directly

```bash
curl -i -X POST "https://ingrazzio-junie-prod.labs.jb.gg/llm/openai/v1/chat/completions" \
  -H "Authorization: Bearer perm-XXX" \
  -H "Content-Type: application/json" \
  -d '{"model": "gemini-2-flash-exp", "messages": [{"role": "user", "content": "Hello"}]}'
```

**Response:** `401 Unauthorized` - `Bearer token is malformed`

#### Attempt 2: Using /auth/jetbrains-jwt/register

```bash
curl -i -X POST "https://ingrazzio-junie-prod.labs.jb.gg/auth/jetbrains-jwt/register" \
  -H "Authorization: Bearer perm-..." \
  -H "Content-Type: application/json"
```

**Response:** `401 Unauthorized`

#### Attempt 3: Using /auth/jwt/refresh

```bash
curl -i -X POST "https://ingrazzio-junie-prod.labs.jb.gg/auth/jwt/refresh" \
  -H "Authorization: Bearer perm-..." \
  -H "Content-Type: application/json"
```

**Response:** `401 Unauthorized`

### Next Steps to Investigate

To get the authentication working, we need to:

1. **Capture actual HTTP traffic** from the CLI to see the exact Authorization header format
2. **Analyze the CLI source code** more deeply to understand the token transformation
3. **Check for additional endpoints** that might be used for token exchange
4. **Investigate the `LicenseServerAuthClient.refreshV3()` method** which might be the key
5. **Look for any additional headers** that might be required (e.g., `X-JBA-Token`, custom headers)

### Working CLI Configuration

The CLI does work with the perm-token when you run it:

```bash
export JUNIE_API_KEY="perm-XXX"
./junie-nightly-633.1-linux-amd64/junie-app/bin/junie
```

The CLI will:
- Store the token in `~/.junie/secure_credentials.json`
- Successfully make API requests to `ingrazzio-junie-prod.labs.jb.gg`
- Log activity to `~/.junie/logs/junie.log`
```

### Discovered API Classes

The following classes are involved in authentication:

| Class | Purpose |
|-------|---------|
| `JunieAuthUtil` | Generates local ECDSA P-256 key pairs and JWTs |
| `JunieAuthData` | Holds public/private key pairs for JWT signing |
| `LicenseServerAuthClient` | Has `refreshV3()` method for token operations |
| `SuspendableAPIGatewayClient` | Main API gateway client |
| `V5Headers` | Handles V5 authentication headers |

### Research Notes

- The CLI appears to use a custom authentication scheme that doesn't follow standard JWT exchange patterns
- Local JWT generation suggests the CLI might be signing requests rather than exchanging tokens
- The `perm-*` token format appears to be a proprietary JetBrains license token format
- The authentication might involve challenge-response or proof-of-possession mechanisms

```bash
#!/bin/bash
# Quick auth script to get JWT token from license token

LICENSE_TOKEN="perm-YOUR_PERM_TOKEN_HERE"
BASE_URL="https://ingrazzio-junie-prod.labs.jb.gg"

# Step 1: Register
echo "Registering license..."
curl -s -X POST "$BASE_URL/auth/jetbrains-jwt/register" \
  -H "Authorization: Bearer $LICENSE_TOKEN" \
  -H "Content-Type: application/json"

echo -e "\n\nRefreshing for JWT token..."
# Step 2: Get JWT token
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/jwt/refresh" \
  -H "Authorization: Bearer $LICENSE_TOKEN" \
  -H "Content-Type: application/json")

echo "$RESPONSE" | jq -r '.token'

# Extract and export token
API_TOKEN=$(echo "$RESPONSE" | jq -r '.token')
export API_TOKEN

echo -e "\n\nAPI Token ready: ${API_TOKEN:0:50}..."
```

⚠️ **WARNING:** This script is NOT working yet. Both endpoints return 401 errors. The authentication method is still unknown.

## Environment Variables

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `INGRAZZIO_URL` | `https://ingrazzio-junie-prod.labs.jb.gg` | API Base URL |
| `INGRAZZIO_ACCESS_TOKEN` | *(required)* | Bearer Token for authentication |
| `INGRAZZIO_GITHUB_ACCESS_TOKEN` | - | GitHub-specific access token |
| `INGRAZZIO_KINETO_ACCESS_TOKEN` | - | Kineto-specific access token |
| `MATTERHORN_GRAZIE_USER_ACCESS_TOKEN` | - | Alternative user token |
| `MATTERHORN_GRAZIE_APPLICATION_ACCESS_TOKEN` | - | Application token |
| `MATTERHORN_GRAZIE_STAGING_URL` | - | Staging URL override |

### LLM Provider Configuration

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_URL` | Anthropic API URL override |
| `ANTHROPIC_MODEL_KEY` | Anthropic model key (default: `ANTHROPIC_API_KEY`) |
| `OPENAI_API_URL` | OpenAI API URL override |
| `OPENAI_MODEL_KEY` | OpenAI model key (default: `OPENAI_API_KEY`) |
| `NEBIUS_API_URL` | Nebius API URL |
| `NEBIUS_MODEL_KEY` | Nebius API key (default: `NEBIUS_API_KEY`) |
| `NEBIUS_PROD_API_URL` | Nebius Production API URL |
| `NEBIUS_PROD_MODEL_KEY` | Nebius Prod API key (default: `NEBIUS_PROD_API_KEY`) |
| `DEEPSEEK_API_URL` | DeepSeek API URL |
| `DEEPSEEK_MODEL_KEY` | DeepSeek API key (default: `DEEPSEEK_API_KEY`) |
| `GOOGLE_MODEL_URL` | Google API URL (default: `GOOGLE_API_URL`) |
| `GOOGLE_MODEL_KEY` | Google API key (default: `GOOGLE_API_KEY`) |
| `MISTRAL_MODEL_URL` | Mistral API URL (default: `MISTRAL_API_URL`) |
| `MISTRAL_MODEL_KEY` | Mistral API key (default: `MISTRAL_API_KEY`) |
| `MOONSHOT_MODEL_URL` | Moonshot API URL (default: `MOONSHOT_API_URL`) |
| `MOONSHOT_MODEL_KEY` | Moonshot API key (default: `MOONSHOT_API_KEY`) |
| `XAI_MODEL_URL` | xAI API URL (default: `XAI_API_URL`) |
| `XAI_MODEL_KEY` | xAI API key (default: `XAI_API_KEY`) |
| `LITELLM_MODEL_URL` | LiteLLM API URL (default: `LITELLM_API_URL`) |
| `LITELLM_MODEL_KEY` | LiteLLM API key (default: `LITELLM_API_KEY`) |

### Other Configuration

| Variable | Description |
|----------|-------------|
| `MATTERHORN_DEFAULT_MODEL` | Default LLM model (default: see below) |
| `MATTERHORN_DEFAULT_LLM_PROVIDER` | Default LLM provider (default: `OpenAI`) |
| `MATTERHORN_DEFAULT_MODEL_TEMPERATURE` | Default temperature |
| `MATTERHORN_DEFAULT_MODEL_TOP_P` | Default top-p |
| `MATTERHORN_LLM_RANDOM_SEED` | Random seed for LLM |
| `MATTERHORN_CAN_READ_FROM_REDIS` | Redis read permission |
| `MATTERHORN_CAN_WRITE_TO_REDIS` | Redis write permission |
| `MATTERHORN_ENVIRONMENT_SERVER_PORT` | Environment server port |
| `JBA_ID_TOKEN` | JBA ID Token |
| `DIRECT_PROXY_URL` | Direct proxy URL |

### Default Models

| Provider | Default Model |
|----------|---------------|
| OpenAI | `gpt-4o-2024-08-06` |
| Anthropic | `claude-3-7-sonnet-20250219` |
| GPT-5 | `gpt-5-2025-08-07` |

## API Endpoints

### Authentication Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/jwt/verify` | POST | Verify JWT token |
| `/auth/jwt/refresh` | POST | Refresh JWT token |
| `/auth/jwt/verifyV3` | POST | Verify JWT token V3 |
| `/auth/jwt/refreshV3` | POST | Refresh JWT token V3 |
| `/auth/jetbrains-jwt/register` | POST | Register with JetBrains JWT |
| `/auth/jetbrains-jwt/user-info` | POST | Get user info |
| `/auth/datalore/provide-access` | POST | Datalore access |
| `/auth/eap-finished` | POST | EAP finished |
| `/auth/extension-uninstall` | POST | Extension uninstall |
| `/auth/geo-block` | POST | Geo block check |
| `/auth/google` | POST | Google auth |
| `/auth/ides/provide-access` | POST | IDEs provide access |
| `/auth/jetbrains` | POST | JetBrains auth |

### Task Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/task/stream/v4/` | POST | Task streaming V4 (SSE) |
| `/task/stream/v5/` | POST | Task streaming V5 (SSE) |
| `/task/executeV2` | POST | Execute task V2 |
| `/task/roster` | POST | Task roster |

#### Task API Response Data Types (V4/V5)

- `TaskStreamData` - Base task stream data
- `TaskStreamText` - Text content
- `TaskStreamQuotaMetadata` - Quota information
- `TaskStreamExecutionMetadata` - Execution metadata
- `TaskStreamFunctionCall` - Function call data
- `TaskStreamFinishMetadata` - Finish metadata
- `TaskStreamUnknownData` - Unknown/other data

### LLM Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/llm/profiles/v9` | POST | Get available LLM profiles/models |
| `/llm/anthropic/v1/messages` | POST | Anthropic messages API |
| `/llm/anthropic/v1/messages/count_tokens` | POST | Count tokens (Anthropic) |
| `/llm/openai/v1/responses` | POST | OpenAI responses API (chat) |
| `/llm/openai/v1/completions` | POST | OpenAI completions API |
| `/llm/credits/v1` | POST | Get LLM credits |

**Note**: The LLM endpoints use a `llm/` prefix, so the full path is `/llm/anthropic/v1/messages`

#### Models/Profiles Endpoint

The `/llm/profiles/v9` endpoint returns available LLM models and their configurations.

**Request:**
```bash
curl -X POST "https://ingrazzio-junie-prod.labs.jb.gg/llm/profiles/v9" \
  -H "Authorization: Bearer $INGRAZZIO_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:** Returns a list of available LLM profiles with their capabilities, models, and configuration options.

### User Attribute Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/user/event/connect` | POST | Connect user event |
| `/attribute/get` | POST | Get attributes |
| `/attribute/store` | POST | Store attributes |
| `/attribute/delete` | POST | Delete attributes |

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/attribute/get` | POST | Get admin attributes |
| `/admin/attribute/store` | POST | Store admin attributes |
| `/admin/auth/login` | POST | Admin login |

### Other Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/quota/get` | POST | Get quota |
| `/enterprise/quota` | POST | Enterprise quota |
| `/feedback/submit` | POST | Submit feedback |
| `/gec/correct/v1` | POST | Grammar correction V1 |
| `/gec/correct/v2` | POST | Grammar correction V2 |
| `/gec/correct/v3` | POST | Grammar correction V3 |
| `/gec/correct/v4` | POST | Grammar correction V4 |
| `/trf/synonymize` | POST | Synonymize text |
| `/trf/summarize` | POST | Summarize text |
| `/trf/translate` | POST | Translate text |
| `/trf/nlc/complete` | POST | Complete text (NLC) |
| `/trf/nlc/completeWithoutPrefix` | POST | Complete without prefix |
| `/indexing/index` | POST | Indexing API |

## Full URL Construction

The full URL is constructed as:
```
{BASE_URL}/{API_PATH}
```

### Example Request

```http
POST https://ingrazzio-junie-prod.labs.jb.gg/task/stream/v4/
Authorization: Bearer your-token-here
Content-Type: application/json

{
  "task": "your task data here"
}
```

## LLM Messages API - Curl Examples

### ⚠️ IMPORTANT: ACTUAL API FORMAT DISCOVERED

**Through mitmproxy traffic capture, the actual working API endpoints and formats have been discovered.**

The CLI uses **different endpoints and formats** than standard OpenAI/Anthropic APIs:

| What was expected | **ACTUAL (from traffic capture)** |
|-------------------|-----------------------------------|
| `/llm/openai/v1/chat/completions` | `/v1/responses` |
| `messages` array | `input` array |
| Standard headers | Special headers: `Openai-Version`, `X-Keep-Path`, `X-LLM-Model` |

### Working API Calls (Extracted from CLI Traffic)

#### 1. Main Chat Completions - `/v1/responses`

**Endpoint:** `POST https://ingrazzio-for-junie-cloud-prod.labs.jb.gg/v1/responses`

**Headers:**
```http
Authorization: Bearer <perm-token>
Content-Type: application/json
Accept: text/event-stream,application/json
Openai-Version: 2020-11-07
User-Agent: ktor-client
X-Keep-Path: true
X-LLM-Model: grok
```

**Request Body Format:**
```json
{
  "model": "grok-4-1-fast-reasoning",
  "input": [
    {"role": "system", "content": "System prompt here..."},
    {"role": "user", "content": "User message here..."}
  ],
  "tools": [
    {
      "type": "function",
      "name": "tool_name",
      "description": "Tool description",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  ],
  "include": ["reasoning.encrypted_content"],
  "truncation": "auto",
  "parallel_tool_calls": false,
  "stream": false,
  "tool_choice": "required",
  "text": {},
  "store": false,
  "prompt_cache_key": "optional-cache-key"
}
```

#### 2. Simple Chat - Root Endpoint

**Endpoint:** `POST https://ingrazzio-for-junie-cloud-prod.labs.jb.gg/`

**Headers:**
```http
Authorization: Bearer <perm-token>
Content-Type: application/json
Accept: text/event-stream,application/json
User-Agent: ktor-client
X-LLM-Model: openai
```

**Request Body (simpler format):**
```json
{
  "model": "gpt-4.1-mini-2025-04-14",
  "messages": [
    {"role": "system", "content": "You are a language detection utility."},
    {"role": "user", "content": "Hello World"}
  ],
  "temperature": 0.0,
  "stream": false,
  "seed": 100000
}
```

#### 3. Router Classification - `/v1/responses`

Used by CLI to classify which agent should handle a request:

```json
{
  "model": "gpt-5-2025-08-07",
  "input": [
    {"role": "system", "content": "Router system prompt..."},
    {"role": "user", "content": "## ISSUE DESCRIPTION\n<issue_description>\nTask here\n</issue_description>"}
  ],
  "tools": [
    {
      "type": "function",
      "name": "submit",
      "description": "Classify the user request...",
      "parameters": {
        "type": "object",
        "properties": {
          "taskType": {"type": ["string", "null"], "enum": ["TextTask", "PlanTask", "MergeTask", "BashTask", "BashCommand", "McpInstallationTask"]}
        }
      }
    }
  ],
  "include": ["reasoning.encrypted_content"],
  "truncation": "auto",
  "parallel_tool_calls": false,
  "stream": false,
  "tool_choice": "required",
  "text": {},
  "reasoning": {"effort": "minimal"},
  "store": false
}
```

### Analytics Events

**Endpoint:** `POST https://ingrazzio-for-junie-cloud-prod.labs.jb.gg/api/analytics/events`

The CLI sends analytics events for tracking:

```json
{
  "id": "cb2b1c09-ad72-48f0-b5f3-aef352cafaf6",
  "session_id": "session-260127-123227-tdkh",
  "app_version": "633.1",
  "event_type": "agent_step_started",
  "properties": {
    "chain_id": "b7025f23-2db5-417f-a852-93bc57f5630b",
    "agent_run_id": "8ebb4be9-d85e-4808-ac5c-687b9ffd6a47"
  },
  "timestamp": "2026-01-27T11:32:27.750438015Z"
}
```

### Test the API Yourself

Here's a simple Python test based on the captured traffic:

```python
import urllib.request
import json

url = "https://ingrazzio-for-junie-cloud-prod.labs.jb.gg/"
token = "perm-XXX"

data = {
    "model": "gpt-4.1-mini-2025-04-14",
    "messages": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Say 'Hello World' in JSON format."}
    ],
    "temperature": 0.0,
    "stream": False
}

req = urllib.request.Request(
    url,
    data=json.dumps(data).encode('utf-8'),
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'ktor-client',
        'X-LLM-Model': 'openai'
    }
)

response = urllib.request.urlopen(req, timeout=30)
print(response.read().decode())
```

### Setup

First, set your token as an environment variable:
```bash
export INGRAZZIO_ACCESS_TOKEN="your-bearer-token-here"
export BASE_URL="https://ingrazzio-for-junie-cloud-prod.labs.jb.gg"
```

### 1. Get Available Models/Profiles

```bash
curl -X POST "$BASE_URL/llm/profiles/v9" \
  -H "Authorization: Bearer $INGRAZZIO_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

### 2. Anthropic Messages API

**Anthropic Streaming Response:**
```bash
curl -X POST "$BASE_URL/llm/anthropic/v1/messages" \
  -H "Authorization: Bearer $INGRAZZIO_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-7-sonnet-20250219",
    "max_tokens": 1024,
    "stream": true,
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ]
  }'
```

### 3. Count Tokens (Anthropic)

```bash
curl -X POST "$BASE_URL/llm/anthropic/v1/messages/count_tokens" \
  -H "Authorization: Bearer $INGRAZZIO_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-7-sonnet-20250219",
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ]
  }'
```

### 4. OpenAI Responses (Chat) API

```bash
curl -X POST "$BASE_URL/llm/openai/v1/responses" \
  -H "Authorization: Bearer $INGRAZZIO_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-2024-08-06",
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ],
    "max_tokens": 1024
  }'
```

**OpenAI Streaming:**
```bash
curl -X POST "$BASE_URL/llm/openai/v1/responses" \
  -H "Authorization: Bearer $INGRAZZIO_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-2024-08-06",
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ],
    "max_tokens": 1024,
    "stream": true
  }'
```

### 5. OpenAI Completions API

```bash
curl -X POST "$BASE_URL/llm/openai/v1/completions" \
  -H "Authorization: Bearer $INGRAZZIO_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-2024-08-06",
    "prompt": "Hello, how are you?",
    "max_tokens": 1024
  }'
```

### 6. Get LLM Credits

```bash
curl -X POST "$BASE_URL/llm/credits/v1" \
  -H "Authorization: Bearer $INGRAZZIO_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

### Example: Simple Python Script for Anthropic API

```python
import requests
import os

BASE_URL = "https://ingrazzio-junie-prod.labs.jb.gg"
TOKEN = os.environ.get("INGRAZZIO_ACCESS_TOKEN")

def send_anthropic_message(message: str, model: str = "claude-3-7-sonnet-20250219"):
    """Send a message to Anthropic API via Junie gateway"""
    url = f"{BASE_URL}/llm/anthropic/v1/messages"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
    }
    data = {
        "model": model,
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": message}]
    }
    response = requests.post(url, json=data, headers=headers)
    return response.json()

# Usage
result = send_anthropic_message("Hello, how are you?")
print(result)
```

### Example: Simple Node.js Script for Anthropic API

```javascript
const BASE_URL = 'https://ingrazzio-junie-prod.labs.jb.gg';
const TOKEN = process.env.INGRAZZIO_ACCESS_TOKEN;

async function sendAnthropicMessage(message, model = 'claude-3-7-sonnet-20250219') {
  const response = await fetch(`${BASE_URL}/llm/anthropic/v1/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: message }]
    })
  });
  return await response.json();
}

// Usage
sendAnthropicMessage('Hello, how are you?')
  .then(result => console.log(result))
  .catch(error => console.error(error));
```

## Java/Kotlin Class References

The following classes were found in the JAR file (`junie-nightly-633.1.jar`):

### Core Classes
- `ai.grazie.api.gateway.client.SuspendableAPIGatewayClient` - Main API Gateway Client
- `ai.grazie.api.gateway.client.api.AuthAPIClient` - Authentication API Client
- `ai.grazie.api.gateway.client.api.task.TasksAPIClient` - Tasks API Client
- `ai.grazie.api.gateway.client.api.llm.LlmAPIClient` - LLM API Client
- `ai.grazie.client.common.cloud.SuspendableCloudClient` - Base Cloud Client

### Configuration Classes
- `com.intellij.ml.llm.matterhorn.settings.MatterhornPropertyProvider` - Property Provider Interface
- `com.intellij.ml.llm.matterhorn.settings.DefaultMatterhornPropertyProvider` - Default Property Provider
- `com.intellij.ml.llm.matterhorn.settings.CoreProperties` - Core Properties Constants
- `com.intellij.ml.llm.matterhorn.ej.app.cli.standalone.agent.StandalonePropertyProviderBuilder` - Standalone Property Builder

### API Model Classes
- `ai.grazie.model.cloud.API` - Base API model
- `ai.grazie.model.cloud.AuthType` - Auth types: `User`, `Application`, `Service`
- `ai.grazie.model.cloud.AuthVersion` - Auth versions
- `ai.grazie.model.cloud.HttpMethod` - HTTP methods

### Main Entry Point
- `com.intellij.ml.llm.matterhorn.ej.app.cli.standalone.MainKt` - CLI Main Entry Point

## Auth Types

The API supports three authentication types (from `ai.grazie.model.cloud.AuthType`):

1. **User** - User authentication (default)
2. **Application** - Application-level authentication
3. **Service** - Service-level authentication

## Source File Location

The analyzed JAR file is located at:
```
junie-nightly-633.1-linux-amd64/junie-app/lib/app/junie-nightly-633.1.jar
```

## Configuration File

The CLI configuration is in:
```
junie-nightly-633.1-linux-amd64/junie-app/lib/app/junie.cfg
```

With main class:
```
app.mainclass=com.intellij.ml.llm.matterhorn.ej.app.cli.standalone.MainKt
```

---

**Document Version**: 1.0
**Extracted from**: junie-nightly-633.1-linux-amd64
**Date**: 2026-01-27
