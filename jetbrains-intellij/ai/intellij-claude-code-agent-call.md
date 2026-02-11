# IntelliJ's Built-in Claude Code Agent - Internal Architecture

*Created: 2026-01-12*

How IntelliJ's own Claude Code agent implementation works internally

---

## Overview

IntelliJ IDEA has a built-in Claude Code agent that communicates with an external `claude-code` binary. This document describes how IntelliJ's internal implementation calls this agent when a user sends a chat message.

---

## Key Internal Classes

### 1. ClaudeCodeChatAgent

**Package:** `com.intellij.ml.llm.agents.claude.code`

The main ChatAgent implementation for Claude Code in IntelliJ.

```kotlin
class ClaudeCodeChatAgent : ChatAgent {
    override val id: String
    override val name: String
    override val icon: Icon = MLLlmAgentsClaudeCodeIcons.Claude

    override suspend fun prepareAnswerMessage(
        session: FrontendSession,
        agentId: ChatSessionAgentId,
        messages: List<ChatMessage>,
        attachmentKindsProvider: AttachmentKindsProvider
    ): AgentClientRunResult

    override fun createRunConfiguration(
        project: Project,
        session: ChatSession
    ): ChatAgentRunConfiguration
}
```

### 2. ClaudeCodeService

**Package:** `com.intellij.ml.llm.agents.claude.code`

Service for managing Claude Code sessions per project.

```kotlin
class ClaudeCodeService(val project: Project) {
    private val chatIdToSession: Map<String, ClaudeCodeSession>

    companion object {
        fun getInstance(project: Project): ClaudeCodeService
    }

    fun createSession(serverInfo: ClaudeServerInfo): ClaudeCodeSession
}
```

### 3. ClaudeCodeSession (Interface)

**Package:** `com.intellij.ml.llm.agents.claude.code`

Interface for Claude Code sessions with two implementations:

```kotlin
interface ClaudeCodeSession : Disposable {
    val mode: SessionMode
    val serverInfo: ClaudeServerInfo

    suspend fun runRequest(
        messages: List<ClaudeMessage>,
        tools: List<ClaudeTool>
    ): Flow<ClaudeResponseEvent>
}

enum class SessionMode {
    LONG_RUNNING,  // ClaudeCodeLongRunningSession
    ONE_SHOT       // ClaudeCodeOneShotSession
}
```

### 4. ClaudeServerInfo

**Package:** `com.intellij.ml.llm.agents.claude.code`

Configuration for server connection.

```kotlin
data class ClaudeServerInfo(
    val baseUrl: String?,
    val token: String?,
    val apiKey: String?,
    val headers: Map<String, String>?,
    val timeout: Int,
    val customData: Any?
)
```

### 5. ClaudeCodeProcessHandler

**Package:** `com.intellij.ml.llm.agents.claude.code.process`

Handles spawning and communicating with the Claude binary.

```kotlin
class ClaudeCodeProcessHandler {
    companion object {
        fun startClaudeCode(
            claudeCodePath: Path,
            workingDirectory: Path,
            baseUrl: String?,
            token: String?,
            apiKey: String?,
            customHeaders: String?,
            // ... more parameters
        ): ClaudeCodeProcessHandler
    }

    // Communicates via stdin/stdout with the binary
}
```

### 6. ClaudeHttpRequestHandler

**Package:** `com.intellij.ml.llm.agents.claude.code.proxy`

HTTP proxy for when the binary makes HTTP requests.

```xml
<httpRequestHandler implementation="com.intellij.ml.llm.agents.claude.code.proxy.ClaudeHttpRequestHandler"/>
```

**Endpoint:** `http://localhost:<port>/api/claude-proxy`

---

## Call Flow When User Sends Message

```
┌─────────────────────────────────────────────────────────────────────┐
│                         IntelliJ IDEA                              │
│                                                                     │
│  User sends message in Chat UI                                      │
│    ↓                                                                │
│  FrontendSession.submit(agentId, message)                          │
│    ↓                                                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │           ClaudeCodeChatAgent.prepareAnswerMessage()         │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                             │                                       │
│                             ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │           ClaudeCodeService.getInstance(project)             │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                             │                                       │
│                             ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │           getServerInfo() → ClaudeServerInfo                │  │
│  │           - baseUrl, token, apiKey, headers, timeout        │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                             │                                       │
│                             ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │     claudeCodeService.createSession(serverInfo)              │  │
│  │     → ClaudeCodeLongRunningSession or OneShotSession        │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                             │                                       │
│                             ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │     ClaudeCodeProcessHandler.startClaudeCode(               │  │
│  │         claudeCodePath,                                      │  │
│  │         workingDirectory,                                    │  │
│  │         baseUrl, token, apiKey,                              │  │
│  │         customHeaders, ...                                   │  │
│  │     )                                                        │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                             │                                       │
│                             ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │     Binary spawned with environment variables:               │  │
│  │     - ANTHROPIC_BASE_URL                                     │  │
│  │     - ANTHROPIC_AUTH_TOKEN                                   │  │
│  │     - ANTHROPIC_API_KEY                                      │  │
│  │     - ANTHROPIC_CUSTOM_HEADERS                               │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                             │                                       │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    claude-code binary process                       │
│                                                                     │
│  stdin/stdout JSON-RPC Communication Protocol                       │
│                                                                     │
│  IntelliJ sends:                                                    │
│  {                                                                 │
│    "jsonrpc": "2.0",                                               │
│    "id": 1,                                                        │
│    "method": "run",                                                │
│    "params": {                                                     │
│      "messages": [...],                                            │
│      "tools": [...]                                                │
│    }                                                               │
│  }                                                                 │
│                                                                     │
│  Binary responds (streaming):                                      │
│  {"type":"text","text":"Hello"}                                    │
│  {"type":"tool_use","id":"...","name":"read_file"}                 │
│  {"type":"tool_result","tool_use_id":"...","content":"..."}        │
│  {"type":"text","text":" more"}                                    │
│  {"type":"done"}                                                   │
│                                                                     │
│  If configured with ANTHROPIC_BASE_URL (proxy mode):               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Binary makes HTTP POST to ClaudeHttpRequestHandler          │   │
│  │  → /api/claude-proxy                                        │   │
│  │  → Forwards to actual LLM API                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Registry Settings

| Registry Key | Description |
|--------------|-------------|
| `llm.agent.claude.use.proxy.server` | Enable internal HTTP proxy |
| `llm.agent.claude.remote.proxy.server.enabled` | Remote proxy flag |
| `llm.chat.agent.acp.enabled` | Enable ACP agents (separate from Claude Code) |

**When `llm.agent.claude.use.proxy.server = true`:**
- `baseUrl` in `ClaudeServerInfo` becomes `http://localhost:<port>/api/claude-proxy`
- Binary makes HTTP requests to this local endpoint

---

## Environment Variables Passed to Binary

The `ClaudeCodeProcessHandler.startClaudeCode()` passes these to the binary:

| Variable | Source |
|----------|--------|
| `ANTHROPIC_BASE_URL` | From `ClaudeServerInfo.baseUrl` |
| `ANTHROPIC_AUTH_TOKEN` | From `ClaudeServerInfo.token` |
| `ANTHROPIC_API_KEY` | From `ClaudeServerInfo.apiKey` |
| `ANTHROPIC_CUSTOM_HEADERS` | From `ClaudeServerInfo.headers` |

---

## Two Session Types

### ClaudeCodeLongRunningSession
- Persists across multiple chat messages
- Binary stays running
- More efficient for continuous use

### ClaudeCodeOneShotSession
- Spawns binary for single request
- Terminates after response
- Used for one-off queries

---

## Summary: How IntelliJ Calls Claude Code

1. **User sends message** → `FrontendSession.submit()`
2. **`ClaudeCodeChatAgent.prepareAnswerMessage()`** is called
3. **Get `ClaudeServerInfo`** with baseUrl, token, apiKey
4. **`ClaudeCodeService.createSession()`** creates session
5. **`ClaudeCodeProcessHandler.startClaudeCode()`** spawns binary with env vars
6. **stdin/stdout communication** using JSON-RPC protocol
7. **If proxy enabled**: Binary makes HTTP POST to `ClaudeHttpRequestHandler`
8. **Streaming response** flows back through `Flow<ClaudeResponseEvent>`
9. **UI displays** the final response

---

## Package Structure

```
com.intellij.ml.llm.agents.claude.code
├── ClaudeCodeChatAgent           (Main ChatAgent impl)
├── ClaudeCodeService             (Session management)
├── ClaudeCodeSession             (Interface)
├── ClaudeCodeLongRunningSession  (Persistent session)
├── ClaudeCodeOneShotSession      (One-time session)
├── ClaudeServerInfo              (Server config)
├── process
│   └── ClaudeCodeProcessHandler  (Binary spawning)
└── proxy
    └── ClaudeHttpRequestHandler  (HTTP proxy)
```

---

*Generated from analysis of IntelliJ ML-LLM plugin decompiled sources (version 253)*
