# JetBrains Junie LLM Gateway

*Created: 2026-07-15 (Updated: 2026-09-05)*

The JetBrains Junie gateway (`ingrazzio-cloud-prod.labs.jb.gg`) serves LLM requests for Junie and the JetBrains AI Assistant. It supports two licensing modes controlled by request headers — **EAP** (free test tokens) and **Pro** (paid AI Assistant credits). The gateway can be called directly with Curl or configured as an OpenCode provider without starting the Junie CLI.

## Updating Nightly models

Run `junie --channel=nightly --model test`; the expected failure lists all valid Nightly model IDs. Test new IDs with the matching Curl request and inspect the JAR only for new providers or changed APIs:

```bash
JAR=$(find ~/.local/share/junie/versions -path '*/junie-app/lib/app/junie-nightly-*.jar' -print | sort -V | tail -n 1)
javap -classpath "$JAR" -c -p com.intellij.ml.llm.matterhorn.core.llm.ingrazzio.IngrazzioLLMAccessKt
```

## Licensing Modes

The gateway supports two modes, selected by the `X-Accept-EAP-License` and `X-Accept-Release-License` headers:

| Mode | `X-Accept-EAP-License` | `X-Accept-Release-License` | Token source | Billing |
|---|---|---|---|---|
| **EAP** | `true` | `false` | Junie Nightly / EAP test token | Free (EAP program) |
| **Pro** | *(omit)* | `true` | JetBrains AI Assistant token | AI credits (paid) |

**EAP mode** — launched via `junie --channel=nightly`. Uses a Junie Nightly/EAP token, free credits.
**Pro mode** — standard `junie` (no `--channel` flag), production mode. Requires a JetBrains AI Assistant Pro subscription.

### Quick diff

```text
 EAP                          Pro
────────────────────────────  ────────────────────────────
Authorization: Bearer <EAP>  Authorization: Bearer <AI-Assistant>
X-Accept-EAP-License: true   (omit or false)
X-Accept-Release-License:     X-Accept-Release-License:
  false                         true
```

## Gateway

```text
https://ingrazzio-cloud-prod.labs.jb.gg
```

Successful EAP responses include `x-response-origin: EAP_INGRAZZIO`.

| Models | Path | Body format | `X-LLM-Model` |
|---|---|---|---|
| GPT | `/v1/responses` | OpenAI Responses | `openai` |
| Claude | `/v1/messages` | Anthropic Messages | `anthropic` |
| Gemini | `/v1beta1/projects/jetbrains-grazie/locations/global/publishers/google/models/{model}:generateContent` | Gemini GenerateContent | `google` |
| Grok | `/v1/responses` | OpenAI Responses | `grok` |
| Qwen Flash | `/v1/chat/completions` | OpenAI Chat Completions | `internal-lite-llm` |
| JetBrains Mix | `/llm/vllm/v1/chat/completions` | OpenAI Chat Completions | `jbai` |

Required common headers (EAP mode shown, see [Licensing Modes](#licensing-modes) for Pro):

```text
Authorization: Bearer <token>
Content-Type: application/json
Accept-Encoding: identity
X-Keep-Path: true
X-Accept-EAP-License: true
X-Accept-Release-License: false
```

## Curl without the Junie CLI

### OpenAI

```bash
curl --fail-with-body --silent --show-error \
  'https://ingrazzio-cloud-prod.labs.jb.gg/v1/responses' \
  -H 'Authorization: Bearer YOUR_JUNIE_EAP_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'Accept-Encoding: identity' \
  -H 'X-LLM-Model: openai' \
  -H 'X-Keep-Path: true' \
  -H 'X-Accept-EAP-License: true' \
  -H 'X-Accept-Release-License: false' \
  --data-binary '{
    "model": "gpt-6-astra",
    "input": "Reply with exactly: Hello",
    "stream": false
  }'
```

### Anthropic

```bash
curl --fail-with-body --silent --show-error \
  'https://ingrazzio-cloud-prod.labs.jb.gg/v1/messages' \
  -H 'Authorization: Bearer YOUR_JUNIE_EAP_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'Accept-Encoding: identity' \
  -H 'anthropic-version: 2023-06-01' \
  -H 'X-LLM-Model: anthropic' \
  -H 'X-Keep-Path: true' \
  -H 'X-Accept-EAP-License: true' \
  -H 'X-Accept-Release-License: false' \
  --data-binary '{
    "model": "claude-opus-4-8",
    "max_tokens": 64,
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Hello"
      }
    ]
  }'
```

### Google

```bash
curl --fail-with-body --silent --show-error \
  'https://ingrazzio-cloud-prod.labs.jb.gg/v1beta1/projects/jetbrains-grazie/locations/global/publishers/google/models/gemini-3.8-flash:generateContent' \
  -H 'Authorization: Bearer YOUR_JUNIE_EAP_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'Accept-Encoding: identity' \
  -H 'X-LLM-Model: google' \
  -H 'X-Keep-Path: true' \
  -H 'X-Accept-EAP-License: true' \
  -H 'X-Accept-Release-License: false' \
  --data-binary '{
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "text": "Reply with exactly: Hello"
          }
        ]
      }
    ]
  }'
```

### xAI

```bash
curl --fail-with-body --silent --show-error \
  'https://ingrazzio-cloud-prod.labs.jb.gg/v1/responses' \
  -H 'Authorization: Bearer YOUR_JUNIE_EAP_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'Accept-Encoding: identity' \
  -H 'X-LLM-Model: grok' \
  -H 'X-Keep-Path: true' \
  -H 'X-Accept-EAP-License: true' \
  -H 'X-Accept-Release-License: false' \
  --data-binary '{
    "model": "grok-4.5",
    "input": "Reply with exactly: Hello",
    "stream": false
  }'
```

### Qwen

```bash
curl --fail-with-body --silent --show-error \
  'https://ingrazzio-cloud-prod.labs.jb.gg/v1/chat/completions' \
  -H 'Authorization: Bearer YOUR_JUNIE_EAP_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'Accept-Encoding: identity' \
  -H 'X-LLM-Model: internal-lite-llm' \
  -H 'X-Keep-Path: true' \
  -H 'X-Accept-EAP-License: true' \
  -H 'X-Accept-Release-License: false' \
  --data-binary '{
    "model": "hetzner/Qwen/Qwen3.6-27B-FP8",
    "messages": [
      {
        "role": "user",
        "content": "Reply with exactly: Hello"
      }
    ],
    "max_tokens": 64,
    "stream": false
  }'
```

### Pro mode (AI credits)

To use a JetBrains AI Assistant Pro subscription instead of EAP, change only the auth header and the two license headers. All other headers, the endpoint, and the body stay identical:

```bash
curl --fail-with-body --silent --show-error \
  'https://ingrazzio-cloud-prod.labs.jb.gg/v1/responses' \
  -H 'Authorization: Bearer YOUR_JETBRAINS_AI_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'Accept-Encoding: identity' \
  -H 'X-LLM-Model: openai' \
  -H 'X-Keep-Path: true' \
  -H 'X-Accept-Release-License: true' \
  --data-binary '{
    "model": "gpt-5.6-luna",
    "input": "Reply with exactly: Hello",
    "stream": false
  }'
```

Key differences from EAP:

```diff
-  -H 'Authorization: Bearer YOUR_JUNIE_EAP_TOKEN' \
+  -H 'Authorization: Bearer YOUR_JETBRAINS_AI_TOKEN' \
   ...
-  -H 'X-Accept-EAP-License: true' \
-  -H 'X-Accept-Release-License: false' \
+  -H 'X-Accept-Release-License: true' \
```

The same substitution applies to every curl example above — swap the token, drop `X-Accept-EAP-License`, flip `X-Accept-Release-License` to `true`.

## OpenCode

Merge the provider below into `~/.config/opencode/opencode.jsonc` and replace `YOUR_JUNIE_EAP_TOKEN`.

Standard OpenCode auth works for OpenAI, Grok, and Qwen, but Anthropic and Google use provider-specific key headers instead of the required `Authorization: Bearer` header. Without a plugin, the token must therefore be configured directly in `Authorization`.

`apiKey` is a fixed SDK initialization value. Authentication uses the `Authorization` header.

**DeepSeek V4 Flash:** add `options.sse_eof_fix: true` to the model configuration and install the global plugin from the [SSE EOF fix section](#deepseek-v4-flash-sse-eof-fix) below. This keeps the existing OpenAI-compatible provider and fixes the Junie stream termination for this model.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "jetbrains-junie-eap": {
      "name": "Junie EAP",
      "options": {
        "apiKey": "unused-by-junie-gateway",
        "headers": {
          "Authorization": "Bearer YOUR_JUNIE_EAP_TOKEN",
          "X-Keep-Path": "true",
          "X-Accept-EAP-License": "true",
          "X-Accept-Release-License": "false",
          "Accept-Encoding": "identity"
        }
      },
      "models": {
        "gemini-3-flash-preview": {
          "name": "Gemini 3 Flash Preview",
          "family": "gemini",
          "attachment": true,
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 0.5,
            "output": 3
          },
          "headers": {
            "X-LLM-Model": "google"
          },
          "provider": {
            "npm": "@ai-sdk/google",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1beta1/projects/jetbrains-grazie/locations/global/publishers/google"
          }
        },
        "gemini-3.1-flash-lite": {
          "name": "Gemini 3.1 Flash Lite",
          "family": "gemini",
          "attachment": true,
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 0.25,
            "output": 1.5
          },
          "headers": {
            "X-LLM-Model": "google"
          },
          "provider": {
            "npm": "@ai-sdk/google",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1beta1/projects/jetbrains-grazie/locations/global/publishers/google"
          }
        },
        "gemini-3.1-pro-preview": {
          "name": "Gemini 3.1 Pro Preview",
          "family": "gemini",
          "attachment": true,
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 2,
            "output": 12
          },
          "headers": {
            "X-LLM-Model": "google"
          },
          "provider": {
            "npm": "@ai-sdk/google",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1beta1/projects/jetbrains-grazie/locations/global/publishers/google"
          }
        },
        "gemini-3.5-flash-lite": {
          "name": "Gemini 3.5 Flash Lite",
          "family": "gemini",
          "attachment": true,
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 0.25,
            "output": 1.5,
            "cache_read": 0.025
          },
          "headers": {
            "X-LLM-Model": "google"
          },
          "provider": {
            "npm": "@ai-sdk/google",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1beta1/projects/jetbrains-grazie/locations/global/publishers/google"
          }
        },
        "gemini-3.6-flash": {
          "name": "Gemini 3.6 Flash",
          "family": "gemini",
          "attachment": true,
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 0.75,
            "output": 3.75,
            "cache_read": 0.15
          },
          "headers": {
            "X-LLM-Model": "google"
          },
          "provider": {
            "npm": "@ai-sdk/google",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1beta1/projects/jetbrains-grazie/locations/global/publishers/google"
          }
        },
        "gemini-3.7-flash": {
          "name": "Gemini 3.7 Flash",
          "family": "gemini",
          "attachment": true,
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 0.4,
            "output": 2.4
          },
          "headers": {
            "X-LLM-Model": "google"
          },
          "provider": {
            "npm": "@ai-sdk/google",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1beta1/projects/jetbrains-grazie/locations/global/publishers/google"
          }
        },
        "gemini-3.8-flash": {
          "name": "Gemini 3.8 Flash",
          "family": "gemini",
          "attachment": true,
          "reasoning": true,
          "temperature": false,
          "tool_call": true,
          "cost": {
            "input": 0.75,
            "output": 3.75
          },
          "headers": {
            "X-LLM-Model": "google"
          },
          "provider": {
            "npm": "@ai-sdk/google",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1beta1/projects/jetbrains-grazie/locations/global/publishers/google"
          }
        },
        "gemini-early-exp": {
          "name": "Gemini Early Exp",
          "family": "gemini",
          "attachment": true,
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 0.75,
            "output": 3.75
          },
          "headers": {
            "X-LLM-Model": "google"
          },
          "provider": {
            "npm": "@ai-sdk/google",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1beta1/projects/jetbrains-grazie/locations/global/publishers/google"
          }
        },
        "claude-fable-5": {
          "name": "Claude Fable 5",
          "family": "claude-fable",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 10,
            "output": 50
          },
          "headers": {
            "X-LLM-Model": "anthropic"
          },
          "provider": {
            "npm": "@ai-sdk/anthropic",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "claude-fable-5-1": {
          "name": "Claude Fable 5.1",
          "family": "claude-fable",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 10,
            "output": 50
          },
          "headers": {
            "X-LLM-Model": "anthropic"
          },
          "provider": {
            "npm": "@ai-sdk/anthropic",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "claude-opus-4-6": {
          "name": "Claude Opus 4.6",
          "family": "claude-opus",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 5,
            "output": 25
          },
          "headers": {
            "X-LLM-Model": "anthropic"
          },
          "provider": {
            "npm": "@ai-sdk/anthropic",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "claude-opus-4-7": {
          "name": "Claude Opus 4.7",
          "family": "claude-opus",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 5,
            "output": 25
          },
          "headers": {
            "X-LLM-Model": "anthropic"
          },
          "provider": {
            "npm": "@ai-sdk/anthropic",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "claude-opus-4-8": {
          "name": "Claude Opus 4.8",
          "family": "claude-opus",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 5,
            "output": 25
          },
          "headers": {
            "X-LLM-Model": "anthropic"
          },
          "provider": {
            "npm": "@ai-sdk/anthropic",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "claude-opus-5": {
          "name": "Claude Opus 5",
          "family": "claude-opus",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 5,
            "output": 25
          },
          "headers": {
            "X-LLM-Model": "anthropic"
          },
          "provider": {
            "npm": "@ai-sdk/anthropic",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "claude-sonnet-4-6": {
          "name": "Claude Sonnet 4.6",
          "family": "claude-sonnet",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 3,
            "output": 15
          },
          "headers": {
            "X-LLM-Model": "anthropic"
          },
          "provider": {
            "npm": "@ai-sdk/anthropic",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "claude-sonnet-5": {
          "name": "Claude Sonnet 5",
          "family": "claude-sonnet",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 2,
            "output": 10
          },
          "headers": {
            "X-LLM-Model": "anthropic"
          },
          "provider": {
            "npm": "@ai-sdk/anthropic",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "gpt-5.3-codex": {
          "name": "GPT-5.3 Codex",
          "family": "gpt",
          "reasoning": true,
          "temperature": false,
          "tool_call": true,
          "cost": {
            "input": 1.75,
            "output": 14
          },
          "headers": {
            "X-LLM-Model": "openai"
          },
          "provider": {
            "npm": "@ai-sdk/openai",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "gpt-5.4": {
          "name": "GPT-5.4",
          "family": "gpt",
          "reasoning": true,
          "temperature": false,
          "tool_call": true,
          "cost": {
            "input": 2.5,
            "output": 15
          },
          "headers": {
            "X-LLM-Model": "openai"
          },
          "provider": {
            "npm": "@ai-sdk/openai",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "gpt-5.5": {
          "name": "GPT-5.5",
          "family": "gpt",
          "reasoning": true,
          "temperature": false,
          "tool_call": true,
          "cost": {
            "input": 5,
            "output": 30
          },
          "headers": {
            "X-LLM-Model": "openai"
          },
          "provider": {
            "npm": "@ai-sdk/openai",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "gpt-5.6-luna": {
          "name": "GPT-5.6 Luna",
          "family": "gpt",
          "reasoning": true,
          "temperature": false,
          "tool_call": true,
          "cost": {
            "input": 0.20,
            "output": 1.20
          },
          "headers": {
            "X-LLM-Model": "openai"
          },
          "provider": {
            "npm": "@ai-sdk/openai",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "gpt-5.6-sol": {
          "name": "GPT-5.6 Sol",
          "family": "gpt",
          "reasoning": true,
          "temperature": false,
          "tool_call": true,
          "cost": {
            "input": 5,
            "output": 30
          },
          "headers": {
            "X-LLM-Model": "openai"
          },
          "provider": {
            "npm": "@ai-sdk/openai",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "gpt-5.6-terra": {
          "name": "GPT-5.6 Terra",
          "family": "gpt",
          "reasoning": true,
          "temperature": false,
          "tool_call": true,
          "cost": {
            "input": 2.00,
            "output": 12.00
          },
          "headers": {
            "X-LLM-Model": "openai"
          },
          "provider": {
            "npm": "@ai-sdk/openai",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "gpt-6-astra": {
          "name": "GPT-6 Astra",
          "family": "gpt",
          "reasoning": true,
          "temperature": false,
          "tool_call": true,
          "cost": {
            "input": 10,
            "output": 50,
            "cache_read": 1
          },
          "headers": {
            "X-LLM-Model": "openai"
          },
          "provider": {
            "npm": "@ai-sdk/openai",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "grok-4.3": {
          "name": "Grok 4.3",
          "family": "grok",
          "reasoning": true,
          "temperature": false,
          "tool_call": true,
          "cost": {
            "input": 1.25,
            "output": 2.5
          },
          "headers": {
            "X-LLM-Model": "grok"
          },
          "provider": {
            "npm": "@ai-sdk/openai",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "grok-4.5": {
          "name": "Grok 4.5",
          "family": "grok",
          "attachment": true,
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 2,
            "output": 6,
            "cache_read": 0.5,
            "cache_write": 0
          },
          "headers": {
            "X-LLM-Model": "grok"
          },
          "provider": {
            "npm": "@ai-sdk/openai",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "grok-4.6": {
          "name": "Grok 4.6",
          "family": "grok",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 2,
            "output": 6,
            "cache_read": 0.5,
            "cache_write": 0
          },
          "headers": {
            "X-LLM-Model": "grok"
          },
          "provider": {
            "npm": "@ai-sdk/openai",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "hetzner/Qwen/Qwen3.6-27B-FP8": {
          "name": "Qwen Flash",
          "family": "qwen",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 0.04,
            "output": 0.04
          },
          "headers": {
            "X-LLM-Model": "internal-lite-llm"
          },
          "interleaved": {
            "field": "reasoning_content"
          },
          "provider": {
            "npm": "@ai-sdk/openai-compatible",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/v1"
          }
        },
        "jetbrains-mix": {
          "name": "JetBrains Mix",
          "family": "jetbrains",
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 0.15,
            "output": 0.9
          },
          "headers": {
            "X-LLM-Model": "jbai"
          },
          "provider": {
            "npm": "@ai-sdk/openai-compatible",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/llm/vllm/v1"
          }
        },
        "deepseek-v4-flash": {
          "name": "DeepSeek V4 Flash",
          "family": "deepseek",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 0.2,
            "output": 0.4,
            "cache_read": 0.04
          },
          "headers": {
            "X-LLM-Model": "alicloud"
          },
          "options": {
            "sse_eof_fix": true
          },
          "provider": {
            "npm": "@ai-sdk/openai-compatible",
            "api": "https://ingrazzio-cloud-prod.labs.jb.gg/compatible-mode/v1"
          }
        }
      }
    }
  }
}
```

List and test:

```bash
opencode models jetbrains-junie-eap

opencode run --pure --model jetbrains-junie-eap/gpt-5.6-luna 'Reply with exactly: Hello'
opencode run --pure --model jetbrains-junie-eap/claude-fable-5-1 'Reply with exactly: Hello'
opencode run --pure --model jetbrains-junie-eap/claude-opus-4-8 'Reply with exactly: Hello'
opencode run --pure --model jetbrains-junie-eap/gemini-3.7-flash 'Reply with exactly: Hello'
opencode run --pure --model jetbrains-junie-eap/gemini-early-exp 'Reply with exactly: Hello'
opencode run --pure --model jetbrains-junie-eap/grok-4.6 'Reply with exactly: Hello'
opencode run --pure --model jetbrains-junie-eap/jetbrains-mix 'Reply with exactly: Hello'
```

### DeepSeek V4 Flash SSE EOF fix

Keep the existing `@ai-sdk/openai-compatible` provider. Add the following model option to any model that needs this transport fix:

```jsonc
"options": {
  "sse_eof_fix": true
}
```

With `options.sse_eof_fix: true`, the global plugin fixes DeepSeek V4 Flash SSE termination after `data: [DONE]` and retries transient `429 Throttling.BurstRate` responses during rapid tool follow-ups.

Install the plugin as `~/.config/opencode/plugins/junie-plain-http.js`:

#### `junie-plain-http.js`

```javascript
// Opt-in flag for models with a broken SSE connection close.
const EOF_FIX_FLAG = "sse_eof_fix";
const RATE_LIMIT_DELAYS = [1000, 2000, 4000];

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// Keep all valid SSE data and repair only the final transport error.
function tolerateEofAfterDone(response) {
  if (!response.body) return response;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let seenDone = false;
  let tail = "";
  const body = new ReadableStream({
    async pull(controller) {
      try {
        const part = await reader.read();
        if (part.done) return controller.close();

        // Keep a short tail because [DONE] can span two chunks.
        const text = tail + decoder.decode(part.value, { stream: true });
        seenDone ||= text.includes("data: [DONE]");
        tail = text.slice(-32);
        controller.enqueue(part.value);
      } catch (error) {
        // Errors before [DONE] are real provider errors and must propagate.
        if (seenDone) controller.close();
        else controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function createEofFixFetch(modelIds, originalFetch = fetch) {
  return async function junieFetch(input, init = {}) {
    if (typeof init.body !== "string") return originalFetch(input, init);

    let request;
    try {
      request = JSON.parse(init.body);
    } catch {
      return originalFetch(input, init);
    }

    // Leave every unmarked model and non-streaming request untouched.
    if (!modelIds.has(request.model) || request.stream !== true) {
      return originalFetch(input, init);
    }

    let response = await originalFetch(input, init);
    // Tool follow-ups can briefly trigger Junie's burst-rate limit.
    for (const delay of RATE_LIMIT_DELAYS) {
      if (response.status !== 429) break;
      await response.body?.cancel();
      await wait(delay);
      response = await originalFetch(input, init);
    }
    return response.ok ? tolerateEofAfterDone(response) : response;
  };
}

export const JuniePlainHttpPlugin = async () => ({
  async config(config) {
    for (const provider of Object.values(config.provider ?? {})) {
      const modelIds = Object.entries(provider?.models ?? {})
        .filter(([, model]) => model?.options?.[EOF_FIX_FLAG] === true)
        .map(([modelId]) => modelId);
      if (!modelIds.length) continue;

      // Preserve another provider-specific fetch wrapper if present.
      const originalFetch = typeof provider.options?.fetch === "function"
        ? provider.options.fetch
        : fetch;
      provider.options = {
        ...(provider.options ?? {}),
        fetch: createEofFixFetch(new Set(modelIds), originalFetch),
      };
    }
  },
});
```

Test:

```bash
opencode run --model jetbrains-junie-eap/deepseek-v4-flash 'Reply with exactly: Hello'
```

### OpenCode Pro mode

For JetBrains AI Assistant Pro, copy the provider above and change only the headers block — rename the provider key if you want to keep both side by side:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "jetbrains-junie-pro": {
      "name": "Junie Pro",
      "options": {
        "apiKey": "unused-by-junie-gateway",
        "headers": {
          "Authorization": "Bearer YOUR_JETBRAINS_AI_TOKEN",
          "X-Keep-Path": "true",
          "X-Accept-Release-License": "true",
          "Accept-Encoding": "identity"
        }
      },
      "models": {
        // ... same model definitions as above, no changes needed
      }
    }
  }
}
```
