# JetBrains Context CLI - Architecture, Indexing, and Privacy

*Created: 2026-07-21*

Analyzed stable release: `jbcontext 0.9.4`, build `313`, commit `86998776fd`  
Platform artifact: Linux x64

## Executive summary

JetBrains Context is a cloud-first semantic code-indexing service with a local CLI and local agent adapters.

- Repository discovery, file reading, language parsing, code chunking, symbol extraction, hashing, and incremental-change detection happen in the local CLI.
- In the default `remote` storage mode, code-derived chunks are sent to the JetBrains AI service. JetBrains computes embeddings, builds and stores a vector index, and serves semantic and cross-repository searches from its cloud.
- Coding agents do not communicate with each other through JetBrains Context. Each agent starts its own local `jbcontext mcp` child process over stdio. Those processes independently use the same JetBrains account and cloud index.
- The CLI contains a working `runtime.storage=local` setting, SQLite metadata storage, and a downloadable local vector-search server. This is not a fully offline mode: authentication is still mandatory, the CLI contacts `api.jetbrains.ai`, and the binary contains remote Qwen embedding and reranking API clients.
- Requiring JetBrains AI is therefore a product and service architecture choice, not a fundamental technical requirement. A fully local version would need a local embedding model and, optionally, a local reranker in addition to the already-present local parsing and vector-storage components.
- The installer is not obviously malicious, does not use `sudo`, and installs only in the user's home directory. However, it verifies downloads only through HTTPS; it does not validate a vendor-published checksum or signature before executing the binary.
- The EAP agreement is explicit that repository data is parsed locally and transmitted to JetBrains cloud infrastructure on Google Cloud Platform. It says raw plain-text source is not retained permanently and the data is not used to train generative models. The persisted vector index can include embeddings, code-structure representations, chunk summaries, extracted comments, and metadata.

For a confidential or regulated repository, the important conclusion is: **do not treat this release as an offline/local-only indexer, even when `runtime.storage` is set to `local`.**

## Scope and method

The analysis used the following evidence:

- The current public installer, runner, version pointer, and Linux x64 binary were downloaded to `/tmp`; the installer itself was not executed.
- CLI help, configuration output, and `setup-agent --dump-auto` were inspected.
- The stripped ELF binary was inspected with `file`, `readelf`, `strings`, targeted byte inspection, and isolated runtime probes.
- Index and MCP probes used fabricated credentials and isolated temporary `HOME` directories. No valid account was used and no repository was successfully indexed.
- Agent installation was executed only inside isolated `/tmp` homes and projects, then the generated files were inspected.
- The public [JetBrains/context integration repository](https://github.com/JetBrains/context) was compared with the templates embedded in the binary.
- The current [product page](https://www.jetbrains.com/agentic-software-development/context/) and [JetBrains Context CLI EAP agreement](https://www.jetbrains.com/legal/docs/terms/jetbrains-context-cli-eap/) were reviewed.

This is not a source-level decompilation. The executable is a stripped GraalVM native image, not a recoverable JAR. The current EAP agreement also expressly restricts reverse engineering and decompilation, so this analysis stops at public source, public behavior, embedded configuration/resources, protocol observation, and high-confidence architectural reconstruction. It does not bypass authentication or technical protections.

## Artifact identity

The stable channel's [version pointer](https://download.jetbrains.com/jetbrains-context/release/version.txt) returned `0.9.4.313` during the analysis.

| Artifact | Size | SHA-256 |
|---|---:|---|
| `download-jbcontext.sh` | 18,486 bytes | `3d9f1a795ea2669fce10165a6a2fddab66c1c3986047ad41ebc3834beb30cfb6` |
| `run-jbcontext.sh` | 10,611 bytes | `8daa0ab5094ba70c343ac0f1597c16530e9d468d6651c51acd70b545cd187495` |
| `context-native-linux-x64-0.9.4.313` | 146,707,360 bytes | `899d7f7efbd15cc626c65a19dd737cfc353d0c9c28507003b0c5399a9c001a21` |

These are observed hashes, not hashes independently published or signed by JetBrains. They identify exactly what was inspected but do not establish a trust chain.

Relevant artifacts:

- [Installer script](https://download.jetbrains.com/jetbrains-context/release/download-jbcontext.sh)
- [Versioned runner](https://download.jetbrains.com/jetbrains-context/builds/v0.9.4.313/run-jbcontext.sh)
- [Versioned Linux x64 binary](https://download.jetbrains.com/jetbrains-context/builds/v0.9.4.313/context-native-linux-x64-0.9.4.313)
- [Public integration repository at inspected commit `0cc5dc1`](https://github.com/JetBrains/context/commit/0cc5dc12497edb480a42495bf86c7a142b785ee2)

The binary is a stripped, dynamically linked x86-64 ELF produced as a GraalVM native image. Its direct dynamic dependencies are limited to common system libraries (`libz`, `libdl`, `libpthread`, `librt`, and `libc`), while the Kotlin/JVM application and most libraries are compiled into the native image.

## What the installer does

The suggested command executes a mutable network response directly:

```bash
curl -fsSL https://download.jetbrains.com/jetbrains-context/release/download-jbcontext.sh | bash
```

The current script performs these steps:

1. Detects Linux/macOS/Windows and x64/arm64.
2. Reads the current version from `release/version.txt` unless a version is pinned.
3. Downloads a platform-specific native binary and matching runner script.
4. Installs versioned files under `~/.jbcontext/versions/<version>/`.
5. Creates or refreshes:
   - `~/.jbcontext/bin/jbcontext_binary` as a symlink to the active version;
   - `~/.jbcontext/bin/run-jbcontext.sh`;
   - `~/.jbcontext/bin/jbcontext`, a small launcher that executes the runner;
   - `~/.jbcontext/bin/active-version.txt`.
6. Appends `~/.jbcontext/bin` to each existing `~/.bashrc`, `~/.zshrc`, and `~/.profile` that does not already contain it. If none exists, it creates `~/.profile`.
7. Runs `jbcontext --version` as a warm-up check.

It does not request root access or install a system service. The versioned binary installation is performed atomically with a temporary file and rename.

### Installer concerns

- The script and artifacts are protected by TLS in transit, but the installer does not verify a detached signature, certificate pin, or vendor-published checksum.
- `curl | bash` gives the server response immediate code-execution authority and leaves no review point.
- Shell startup files are modified automatically unless `--no-path-update` is used.
- The runner contains updater logic, although its shell-level `CHECK_UPDATE` flag is currently `false`. The CLI configuration still defaults `updates.auto-update` to `true` and exposes an `upgrade` command.
- Agent upgrades may also refresh installed prompts, hooks, instructions, and MCP configuration unless `--skip-agents` or the corresponding persistent configuration is used.

A safer inspection-first installation pattern is:

```bash
curl -fsSLo download-jbcontext.sh \
  https://download.jetbrains.com/jetbrains-context/release/download-jbcontext.sh
less download-jbcontext.sh
bash download-jbcontext.sh --version=0.9.4.313 --no-path-update
```

Pinning the version improves reproducibility, but it still does not replace cryptographic publisher verification.

## Runtime architecture

```text
Claude / Codex / Junie / IntelliJ agent
        |
        | host instructions, skills and optional hooks
        | optional host-native context-explorer subagent
        |
        +---- MCP JSON-RPC over stdio ----> local `jbcontext mcp` process
                                                |
                                                | repository roots / Git remote
                                                | HTTPS + JetBrains authentication
                                                v
                                      JetBrains AI indexing APIs
                                      - embedding computation
                                      - remote vector index
                                      - semantic/hybrid search
                                      - optional expansion/reranking

Local indexing path before upload:

Git/worktree -> ignore/filter -> parser -> declarations/symbols/chunks
             -> clusters + hashes -> snapshot diff -> changed chunks only
```

The code-generating model remains Claude, Codex, Junie, or another host agent. JetBrains AI is a second service used for repository indexing and retrieval; it is not the agent that implements the user's task.

## How the index works

The following reconstruction combines CLI behavior, model/API class names, embedded SQL, endpoints, and the legal description. Items marked as inference are not public implementation guarantees.

### 1. Repository identity and file discovery

- The CLI discovers a Git root and canonical remote URL. The remote URL is used to resolve a repository identity in the service.
- CLI and MCP both permit a `--git-remote-url` override.
- MCP first requests workspace roots from the MCP client using `roots/list`; it derives Git repositories from returned `file://` roots and falls back to the current working directory if root discovery fails.
- The binary contains JGit-based file and revision handling, local-change detection, `.gitignore` support, `.aiexclude` support, file-size limits, default excluded directories, and path-safety validation.
- Non-Git directories appear to receive a generated directory identifier, but the normal sharing and cross-repository path is built around Git remote identity.

### 2. Local parsing and semantic units

Parsing happens locally. The binary contains JetBrains/Fleet-derived syntax parsers and symbol collectors for Java, Kotlin, Python, JavaScript/TypeScript, Rust, Go, PHP, and C#. It also contains generic text chunking for unsupported or non-structural files. The product page additionally advertises C++ and other major languages; those may use a less specialized or separately mapped path in this build.

Visible indexing concepts include:

- code-declaration extraction with oversized-declaration splitting;
- language-specific symbol collection;
- generic text chunks;
- file-level entries;
- lexical metadata such as declaration names;
- repository-profile inputs such as README and manifest files;
- source positions containing path and byte/character offsets.

The public and CLI terminology exposes three index aliases:

- `code-blocks`
- `symbols`
- `files`

This means the index is not simply one embedding per file. It stores multiple semantic granularities so a query can retrieve a declaration, symbol, code region, or relevant file rather than an entire repository file.

### 3. Clustering, snapshots, and incremental updates

The CLI groups files into clusters, computes hashes, and records snapshots. Embedded SQLite schema and model names show:

- a `snapshot` table keyed by revision, with branch, creator version, status, file count/size, language statistics, and commit time;
- a `cluster` table with content hash, leaf hash, path hash, processing statistics, and metadata;
- a `cluster_to_snapshot` mapping;
- a `chunk` table with cluster, type, path, start/end offsets, metadata, and vector ID;
- a `chunk_hash_to_vector` deduplication mapping.

The indexer calculates a Git-based snapshot diff where possible. Unchanged clusters can be reused; only new or changed clusters are parsed/embedded again. If Git diff calculation fails, the CLI logs that it will index without the diff optimization.

This is the basis for the product's “incremental repository indexing” claim. Hooks can run `index --silent` repeatedly because content, path, and cluster hashes permit reuse rather than a complete rebuild every time.

### 4. Default remote indexing

The default configuration is:

```yaml
runtime:
  storage: remote
```

The binary includes these relevant API paths:

```text
/indexing/snapshot
/indexing/index-chunks
/indexing/finalize-snapshot
/indexing/get-clusters
/indexing/try-reuse-clusters
/indexing/reuse-clusters
/indexing/finalize-clusters
/indexing/index-repository-profile
/indexing/embeddings/qwen/compute
/indexing/embeddings/qwen/retrieve
/indexing/search
/indexing/extended-search
/indexing/rerank/qwen
/indexing/repositories
```

The high-confidence remote flow is:

1. Create or resolve repository/index descriptors and a revision snapshot.
2. Compare cluster hashes with an existing snapshot and reuse unchanged clusters.
3. Upload changed semantic chunks and lexical metadata.
4. Compute embeddings and persist the resulting vector index in JetBrains cloud storage.
5. Finalize clusters and snapshot metadata.

The EAP agreement confirms that repository data is locally parsed, transmitted to JetBrains, and used to create a persistently hosted vector index.

### 5. Search

The search CLI defaults observed in this build are:

```yaml
search:
  max-items: 50
  snippets:
    max-items: 10
    threshold: 0.7
```

The binary explicitly labels the search as `Hybrid (embedding + text)`. Its model classes and pipeline names show retrieval, query expansion, neighboring-chunk search, merging/diversification, and optional reranking. Example pipeline names include `retrieve-expand-rerank`, `retrieve-rerank-merge`, and `neighbor-search-merge`.

Search sends the natural-language query and repository/revision/path filters to the service. Results contain ranked paths, source positions, scores, and relevant snippets. The agent is instructed to read the returned file locally after the initial semantic search, rather than repeatedly asking the semantic service or loading whole files.

The service can also enumerate and search repositories available to the account or organization. This enables cross-repository discovery, dependency searches, and impact analysis without cloning every repository into the current agent context.

## Remote versus local storage

The CLI accepts:

```bash
jbcontext config set runtime.storage local
```

It then reports `runtime.storage: local`. Static inspection shows a substantial local implementation:

- `LocalIndexingClient` and `LocalSearchClient`;
- local SQLite metadata and snapshot/cluster/chunk tables;
- a downloadable `embedding-search-artifacts` package;
- a separate native `embeddings-server` process;
- local gRPC methods for starting/finishing a storage scope, inserting vectors, checking present/absent IDs, vector/text search, similarity, statistics, clearing storage, and parent-scope adoption;
- cosine, inner-product, squared-L2, and Hamming metrics;
- B1, I8, F16, F32, and F64 quantization modes;
- evidence of USearch-style distance conversion in the client.

However, this mode is not offline:

- Invoking `index` with local storage still enters `IsLoggedInGuard` and fails with `Authentication required` without a JetBrains AI login.
- A network trace of the local-storage path showed DNS resolution and HTTPS connection setup for `api.jetbrains.ai` before local indexing could start.
- The binary contains `EmbArkEmbeddingsClient`, `GrazieLLMEmbeddingProvider`, and the remote `/indexing/embeddings/qwen/compute` and `/retrieve` endpoints.
- It contains a remote Qwen reranking client and `/indexing/rerank/qwen`.
- No local neural embedding model weights are bundled in the 147 MB CLI. Strings name models such as `Qwen/Qwen3-Embedding-0.6B`, `4B`, and `8B`, but the artifact size and remote API paths are inconsistent with those models being executed from bundled weights.

The strongest supported interpretation is:

> `runtime.storage=local` moves vector persistence and nearest-neighbor retrieval to a local SQLite/native-vector stack, but embedding generation, authentication, and at least some search services remain JetBrains-hosted.

This interpretation is based on binary structure and gated runtime behavior. JetBrains does not currently promote local storage on the product page as a supported privacy/offline mode, and the EAP agreement still grants broad cloud-processing permission.

## What leaves the machine

| Data or operation | Local | JetBrains cloud |
|---|---|---|
| Git/worktree discovery and ignore filtering | Yes | Repository identity/remote is sent |
| Syntax parsing and code chunk extraction | Yes | Derived chunks are transmitted for indexing |
| Embedding calculation | Client batches inputs | Qwen embedding API is remote in this build |
| Vector index, default mode | No | Persistently hosted |
| Vector index, `local` mode | Local vector server and SQLite | Remote embedding/auth dependencies remain |
| Search query | Created by agent locally | Sent to JetBrains search/embedding APIs |
| Search results | Returned to CLI/agent | Ranked and optionally reranked remotely |
| Local logs | Enabled by default | Remote operation logging is separately controllable |
| Usage analytics | Enabled by default | Analytics upload endpoints are present |

The [EAP agreement, version 1.0 effective July 15, 2026](https://www.jetbrains.com/legal/docs/terms/jetbrains-context-cli-eap/) says, in substance:

- JetBrains may process repository, configuration, infrastructure-state, operational, input, and output data on Google Cloud Platform to provide the service.
- Data is parsed locally and transmitted to JetBrains for vector-index generation and persistent vector-index hosting.
- Raw plain-text source code is not stored permanently after parsing/index generation.
- The persisted vector index may contain embeddings, mathematical code-structure representations, chunk summaries, comment extractions, and metadata.
- JetBrains says it will not use the EAP data, vector index, or semantic queries to train, fine-tune, or reinforce generative language models.
- EAP diagnostic, usage, and telemetry collection is broader than for generally available products.

“Not permanently stored as raw source” does not mean “source never leaves the machine.” It is transmitted and processed. It also does not mean that no human-readable or source-derived content is persisted: the agreement's vector-index definition explicitly includes summaries, comment extractions, code structure, and metadata.

## How agents are connected

### `setup-agent` is an installer, not an agent bus

`jbcontext setup-agent` writes configuration and prompt assets for the selected host. Depending on the host and flags, it can install:

- a `context-search` skill;
- managed instructions in `AGENTS.md` or `CLAUDE.md`;
- reminder or enforcement hooks;
- MCP registration;
- a host-native `context-explorer` subagent descriptor;
- Codex execution-policy rules.

The public [JetBrains/context repository](https://github.com/JetBrains/context) contains these prompts, skills, hook scripts, MCP descriptions, and subagent descriptors. It does not contain the CLI/indexer implementation.

### Exact MCP transport

Each supported host launches a local process equivalent to:

```json
{
  "mcpServers": {
    "jbcontext": {
      "type": "stdio",
      "command": "jbcontext",
      "args": ["mcp"]
    }
  }
}
```

Codex uses the equivalent TOML:

```toml
[mcp_servers.jbcontext]
command = "jbcontext"
args = ["mcp"]
```

Observed MCP initialization:

```json
{
  "protocolVersion": "2025-06-18",
  "capabilities": {"tools": {"listChanged": false}},
  "serverInfo": {"name": "context-mcp", "version": "0.9.4.313"}
}
```

The server exposes exactly two MCP tools in this build:

1. `code_search`
   - required: `text`
   - optional: `pathFilter`, relative to the project root
   - returns ranked file paths, line-positioned snippets, and scores
2. `find_repositories`
   - optional: `query`, `limit`, and pagination field `startAfter`

The dynamically observed service routes were:

```text
code_search       -> https://api.jetbrains.ai/user/v5/indexing/search
find_repositories -> https://api.jetbrains.ai/user/v5/indexing/repositories
```

MCP startup is gated on JetBrains login and EAP acceptance before it serves JSON-RPC.

### No direct agent-to-agent communication

There is no JetBrains Context mailbox, peer registry, agent identity, task protocol, or shared conversation state connecting Claude, Codex, Junie, and IntelliJ agents.

The actual topology is:

```text
parent agent
  -> host's own subagent mechanism, if requested
    -> context-explorer prompt
      -> jbcontext CLI or MCP search
        -> JetBrains cloud index
      <- search results
    <- short findings report
  <- normal host-native subagent result
```

Two agents using the same authorized repository can query the same cloud index. That is shared repository retrieval, not communication between the agents. They do not receive each other's chat context, reasoning, tool history, or messages through `jbcontext`.

### Host-specific setup matrix

| Host | Auto skill | Auto subagent | Hooks | MCP | Notes |
|---|---:|---:|---:|---:|---|
| Claude Code | Yes | Yes | SessionStart, SessionEnd, reminders | Yes | Optional enforcer can deny broad discovery before semantic bootstrap |
| OpenAI Codex | Yes | No | SessionStart and reminders | Yes | Explicit `--subagents` installs `context_explorer`; no SessionEnd |
| IntelliJ ACP agents | Yes | No | No | Yes | Uses `.ai/mcp/mcp.json` |
| Junie CLI | Yes | Intended, but missing in build 313 | User scope only | Yes | Actual install reported missing `context-explorer` resource |
| Generic | Yes | No | No | Yes | Generic instructions and `.mcp.json` |

The Junie discrepancy is likely a packaging bug: the plan advertises a subagent, but the real isolated setup reports `Subagents: skipped (no resource available): context-explorer` even with explicit `--subagents`.

### Hooks and automatic indexing

The default auto profile can make indexing happen without a human typing `jbcontext index` in each session:

- Codex SessionStart (`startup|resume`) runs `jbcontext index --silent` in the background.
- Claude SessionStart and SessionEnd run an asynchronous silent index.
- Junie user-scope setup installs background SessionStart and SessionEnd indexing.
- Reminder hooks intercept likely broad-discovery tools and add guidance to try semantic search when the relevant subsystem is unknown.
- Claude's opt-in `--hooks-mode enforcer` tracks whether an initial semantic search occurred, whether a returned file was read, and whether the single narrowed retry was consumed. It can deny non-compliant search steps.
- Codex cannot enforce denials through its current PreToolUse schema, so an enforcer request falls back to reminders.

The automatic background index is operationally convenient, but it also means repository changes may be processed and uploaded at agent session boundaries. This should be understood before enabling `--auto` in a sensitive project.

### Codex policy rules

The generated Codex rules allow only these read-only query prefixes outside the normal sandbox approval flow:

```text
["jbcontext", "search"]
["jbcontext", "repos"]
["jbcontext", "find-repositories"]
```

`index` is deliberately not included because it mutates/uploads index state. The rules explain that searches require network access, OS keychain access, and access to a JetBrains daemon socket that a sandbox may otherwise block.

### Native subagents

The optional subagents are small, read-only research workers owned by the host agent runtime:

- Claude's descriptor uses `model: haiku` and permits the jbcontext MCP search plus targeted reads.
- Codex's explicit descriptor uses `model_reasoning_effort = "medium"` and `sandbox_mode = "read-only"`; no exact model is pinned by the descriptor.
- Both are told to use at most three semantic searches and three targeted reads, return real `file:line` evidence and snippets, and avoid edits.
- Codex installs no subagent in `--auto`; the user must explicitly request `--subagents`.

This is why selecting a named model such as “GPT-5.6 Terra Medium” is not part of JetBrains Context itself. JetBrains supplies the descriptor and reasoning-effort hint; the host agent platform decides which model actually runs it.

## Why JetBrains AI is required

The immediate technical reasons in build 313 are:

1. **Authentication is a global gate.** `index`, `search`, and `mcp` resolve a JetBrains AI client before doing useful work.
2. **Embedding inference is remote.** The CLI batches code/query text through JetBrains Qwen embedding endpoints.
3. **The default vector index is remote.** Snapshot, cluster, vector, repository, and cross-repository state live in the JetBrains indexing service.
4. **Search orchestration is remote.** Hybrid retrieval, cross-repository lookup, expansion, and Qwen reranking have service endpoints.
5. **Organization access control and sharing are service features.** Multiple machines and agents can resolve the same repositories according to one JetBrains account/organization.
6. **The EAP and future commercial model are tied to JetBrains AI terms.** The product page says it is free during early access and intended to be included with a JetBrains AI subscription afterward, with final packaging still to be announced.

The likely product reasons are centralized model operation, consistent embedding versions, large-index hosting, organization-wide search, governance, analytics, and future commercial packaging. Those are reasonable architectural inferences, not claims stated by the binary.

## Could it work entirely locally?

Yes. Nothing about semantic code search fundamentally requires JetBrains cloud infrastructure.

This CLI already contains or downloads most of the non-model pieces needed for a local implementation:

- repository scanning and ignore handling;
- structural language parsers and symbol collectors;
- code/file/symbol chunking;
- snapshot diffs and content-hash reuse;
- SQLite metadata;
- a local gRPC vector server with quantization and several distance metrics;
- a local search pipeline.

A truly offline mode would additionally need:

1. a locally runnable code embedding model and tokenizer;
2. local query embedding using the exact same model/version as indexing;
3. a local lexical index if hybrid retrieval is desired;
4. an optional local reranker or a no-reranker pipeline;
5. removal or relaxation of the mandatory JetBrains authentication/EAP service gate;
6. local repository identity, access control, retention, and multi-repository management;
7. local model/version migration when the embedding model changes.

Possible implementations include a small code-oriented embedding model through ONNX Runtime, llama.cpp, or another local inference runtime, plus the existing local vector store. Large Qwen embedding variants would require substantial RAM/VRAM and disk, but smaller models are practical. Search quality and compatibility with JetBrains' hosted index would differ.

So the accurate answer is:

> It does not work fully locally because JetBrains chose not to ship and support the embedding/reranking model and service logic locally in this release—not because local semantic indexing is impossible.

## Security and operational assessment

### Positive observations

- No root privileges or system daemon installation are used by the installer.
- Versioned binaries and atomic replacement reduce partial-update risk.
- The agent MCP transport is local stdio, not a listening TCP server.
- MCP exposes only two narrow read/query tools.
- Codex policy rules intentionally exclude the mutating `index` command.
- Authentication tokens normally use an OS keychain where available; plaintext fallback is visibly warned about when keychain storage is disabled.
- Path filters are normalized and checked against escaping the repository root.
- The local artifact extractor contains zip-slip protection.
- JetBrains states that repository data is not used to train generative models.

### Risks and surprises

- No artifact signature or checksum is verified by the shell installer.
- Raw code is transmitted even though it is not supposed to be retained permanently.
- Vector-index derivatives and metadata are persisted in JetBrains cloud storage.
- Usage analytics default to enabled.
- `setup-agent --auto` installs background indexing hooks and modifies agent behavior/configuration, not merely an MCP entry.
- Prompts and hooks may be refreshed during upgrades.
- The service adds a second external AI/data processor alongside the user's coding-agent provider.
- `runtime.storage=local` can easily be mistaken for an offline privacy mode, but it still requires JetBrains authentication and remote embedding calls.
- The EAP agreement permits broad diagnostic and operational data collection.
- The Junie subagent packaging does not match the advertised setup plan in build 313.

## Recommendations

For ordinary public/open-source repositories:

- The architecture is reasonable if cloud indexing is acceptable.
- Pin the version, inspect the installer, and consider `--no-path-update`.
- Review `setup-agent --dump-auto --print-instructions` before enabling `--auto`.
- Prefer explicit component flags if background hooks or policy rules are unwanted.

For private company repositories:

- Treat JetBrains as a repository-data processor, not just a local developer-tool vendor.
- Obtain legal/security approval for the EAP agreement and JetBrains AI platform terms.
- Confirm organization isolation, deletion, retention, region, incident response, subprocessors, and employee-access controls with JetBrains; they cannot be established from the binary alone.
- Do not rely on “raw source is not permanently stored” as equivalent to “source never leaves the device.”
- Disable analytics if policy permits, and decide explicitly whether background session indexing is acceptable.
- Test removal/logout and hosted-index deletion procedures before broad deployment.

For a strict no-source-egress requirement:

- Do not use this release for those repositories.
- `runtime.storage=local` is insufficient.
- Use or build an end-to-end local embedding and vector-search stack instead.

## Verification limits

- No valid JetBrains account was used, so a complete authenticated indexing payload was not captured.
- No real repository indexing completed; authentication/agreement gates stopped the main dynamic index probes.
- Some payload details are reconstructed from embedded serializers, API names, SQL, and terms rather than decrypted production HTTPS traffic.
- Server-side implementation, encryption at rest, deletion mechanics, human access, and regional placement cannot be verified from the client.
- The product is EAP and can change rapidly. This document describes build `0.9.4.313` and the legal/product pages available on 2026-07-21.

## Primary sources

- [JetBrains Context product page](https://www.jetbrains.com/agentic-software-development/context/)
- [JetBrains Context CLI EAP User Agreement](https://www.jetbrains.com/legal/docs/terms/jetbrains-context-cli-eap/)
- [Current installer script](https://download.jetbrains.com/jetbrains-context/release/download-jbcontext.sh)
- [Stable version pointer](https://download.jetbrains.com/jetbrains-context/release/version.txt)
- [JetBrains/context public integration repository](https://github.com/JetBrains/context)
- [MCP tool description](https://github.com/JetBrains/context/blob/main/mcp/tool-description.txt)
- [Codex context-explorer descriptor](https://github.com/JetBrains/context/blob/main/agents/codex/context-explorer.toml)
- [Claude context-explorer descriptor](https://github.com/JetBrains/context/blob/main/agents/claude/context-explorer.md)
- [Claude enforcement hook](https://github.com/JetBrains/context/blob/main/hooks/pre-tool-use.sh)
