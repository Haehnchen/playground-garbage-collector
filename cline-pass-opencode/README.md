# ClinePass in OpenCode

*Created: 2026-07-11*

This is a dated snapshot of `~/.config/opencode/opencode.jsonc`. It exposes ClinePass to OpenCode as an OpenAI-compatible provider.

## Where the models come from

OpenCode does not include ClinePass or its models. The provider and model definitions used by this configuration come from the Cline CLI source:

- [`builtins.ts`](https://github.com/cline/cline/blob/main/sdk/packages/llms/src/providers/builtins.ts) defines ClinePass as an OpenAI-compatible provider using the Cline API.
- [`catalog.generated.ts`](https://github.com/cline/cline/blob/main/sdk/packages/llms/src/catalog/catalog.generated.ts) contains the ClinePass model definitions mirrored below.

## Configuration

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "cline-pass": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "cline-pass",
      "options": {
        "baseURL": "https://api.cline.bot/api/v1"
      },
      "models": {
        "cline-pass/glm-5.2": {
          "name": "GLM-5.2",
          "family": "glm",
          "release_date": "2026-06-13",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "limit": {
            "context": 1048576,
            "input": 1048576,
            "output": 131072
          },
          "cost": {
            "input": 0.9086,
            "output": 2.8556,
            "cache_read": 0.16874,
            "cache_write": 0
          }
        },
        "cline-pass/kimi-k2.7-code": {
          "name": "Kimi K2.7 Code",
          "family": "kimi-k2",
          "release_date": "2026-06-12",
          "attachment": true,
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "limit": {
            "context": 262144,
            "input": 262144,
            "output": 16384
          },
          "cost": {
            "input": 0.74,
            "output": 3.5,
            "cache_read": 0.15,
            "cache_write": 0
          }
        },
        "cline-pass/kimi-k2.6": {
          "name": "Kimi K2.6",
          "family": "kimi-k2",
          "release_date": "2026-04-21",
          "attachment": true,
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "limit": {
            "context": 262144,
            "input": 262144,
            "output": 262144
          },
          "cost": {
            "input": 0.66,
            "output": 3.41,
            "cache_read": 0.14,
            "cache_write": 0
          }
        },
        "cline-pass/deepseek-v4-pro": {
          "name": "DeepSeek V4 Pro",
          "family": "deepseek-thinking",
          "release_date": "2026-04-24",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "limit": {
            "context": 1048576,
            "input": 1048576,
            "output": 384000
          },
          "cost": {
            "input": 0.435,
            "output": 0.87,
            "cache_read": 0.003625,
            "cache_write": 0
          }
        },
        "cline-pass/deepseek-v4-flash": {
          "name": "DeepSeek V4 Flash",
          "family": "deepseek-flash",
          "release_date": "2026-04-24",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "limit": {
            "context": 1048576,
            "input": 1048576,
            "output": 16384
          },
          "cost": {
            "input": 0.09,
            "output": 0.18,
            "cache_read": 0.018,
            "cache_write": 0
          }
        },
        "cline-pass/mimo-v2.5": {
          "name": "MiMo-V2.5",
          "family": "mimo",
          "release_date": "2026-04-22",
          "attachment": true,
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "limit": {
            "context": 32000,
            "input": 32000,
            "output": 131072
          },
          "cost": {
            "input": 0.105,
            "output": 0.28,
            "cache_read": 0.028,
            "cache_write": 0
          }
        },
        "cline-pass/mimo-v2.5-pro": {
          "name": "MiMo-V2.5-Pro",
          "family": "mimo",
          "release_date": "2026-04-22",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "limit": {
            "context": 1048576,
            "input": 1048576,
            "output": 131072
          },
          "cost": {
            "input": 0.435,
            "output": 0.87,
            "cache_read": 0.0036,
            "cache_write": 0
          }
        },
        "cline-pass/minimax-m3": {
          "name": "MiniMax-M3",
          "family": "minimax",
          "release_date": "2026-06-01",
          "attachment": true,
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "limit": {
            "context": 524288,
            "input": 524288,
            "output": 512000
          },
          "cost": {
            "input": 0.3,
            "output": 1.2,
            "cache_read": 0.06,
            "cache_write": 0
          }
        },
        "cline-pass/qwen3.7-max": {
          "name": "Qwen3.7 Max",
          "family": "qwen",
          "release_date": "2026-05-21",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "limit": {
            "context": 1000000,
            "input": 1000000,
            "output": 65536
          },
          "cost": {
            "input": 1.25,
            "output": 3.75,
            "cache_read": 0.25,
            "cache_write": 1.5625
          }
        },
        "cline-pass/qwen3.7-plus": {
          "name": "Qwen3.7 Plus",
          "family": "qwen",
          "release_date": "2026-06-02",
          "attachment": true,
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "limit": {
            "context": 1000000,
            "input": 1000000,
            "output": 65536
          },
          "cost": {
            "input": 0.32,
            "output": 1.28,
            "cache_read": 0.064,
            "cache_write": 0.4
          }
        }
      }
    },
    "junie-nightly": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Junie Nightly (EAP)",
      "options": {
        "baseURL": "https://ingrazzio-cloud-prod.labs.jb.gg/v1",
        "headers": {
          "X-LLM-Model": "openai",
          "X-Keep-Path": "true",
          "X-Accept-EAP-License": "true",
          "X-Accept-Release-License": "false",
          "Accept-Encoding": "identity"
        }
      },
      "models": {
        "gpt-5.6-luna": {
          "name": "GPT-5.6 Luna (Junie Nightly)",
          "family": "gpt",
          "reasoning": true,
          "temperature": false,
          "tool_call": true
        }
      }
    }
  }
}
```
