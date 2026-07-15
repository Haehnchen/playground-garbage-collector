# JetBrains Junie EAP API

*Created: 2026-07-15*

Junie Nightly uses dedicated EAP test tokens with the JetBrains EAP LLM gateway. The gateway can be called directly with Curl or configured as an OpenCode provider without starting the Junie CLI.

## Updating Nightly models

Copy new models from the `junie --nightly` selector and test them with the matching Curl request. Inspect the JAR only for new providers or changed APIs:

```bash
JAR=$(find ~/.local/share/junie/versions -path '*/junie-app/lib/app/junie-nightly-*.jar' -print | sort -V | tail -n 1)
javap -classpath "$JAR" -c -p com.intellij.ml.llm.matterhorn.core.llm.ingrazzio.IngrazzioLLMAccessKt
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

Required common headers:

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
    "model": "gpt-5.6-luna",
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
  'https://ingrazzio-cloud-prod.labs.jb.gg/v1beta1/projects/jetbrains-grazie/locations/global/publishers/google/models/gemini-3-flash-preview:generateContent' \
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
    "model": "grok-4.3",
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

## OpenCode

Merge the provider below into `~/.config/opencode/opencode.jsonc` and replace `YOUR_JUNIE_EAP_TOKEN`.

`apiKey` is a fixed SDK initialization value. Authentication uses the `Authorization` header.

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
        "gemini-3.5-flash": {
          "name": "Gemini 3.5 Flash",
          "family": "gemini",
          "attachment": true,
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "cost": {
            "input": 1.5,
            "output": 9
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
            "input": 1,
            "output": 6
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
opencode run --pure --model jetbrains-junie-eap/claude-opus-4-8 'Reply with exactly: Hello'
```
