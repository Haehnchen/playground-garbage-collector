# Hetzner Inference API in OpenCode

*Created: 2026-08-11*

This is a dated snapshot of `~/.config/opencode/opencode.jsonc`. It exposes all models currently returned by the Hetzner Experiments Inference API as an OpenAI-compatible OpenCode provider.

## Authentication

Create an API token in [Hetzner Experiments](https://experiments.hetzner.com) under **Inference**, then let OpenCode store it:

```bash
opencode auth login
```

Select `Hetzner` and paste the token. The token does not belong in the configuration below.

## Updating the model list

The exact model IDs and context lengths come from the live endpoint:

```bash
curl -s https://inference.hetzner.com/api/v1/models \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

After updating the configuration, verify OpenCode's resolved metadata with:

```bash
opencode models hetzner --verbose
```

See the [Inference API documentation](https://experiments.hetzner.com/docs/inference) and Hetzner's [OpenCode tutorial](https://community.hetzner.com/tutorials/opencode-with-hetzner-inference-api-systemd-sandbox/de) for the upstream references.

## Configuration

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "hetzner": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Hetzner",
      "options": {
        "baseURL": "https://inference.hetzner.com/api/v1"
      },
      "models": {
        "DeepSeek-V4-Flash-0731": {
          "name": "DeepSeek V4 Flash 0731",
          "family": "deepseek-flash",
          "release_date": "2026-07-31",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "status": "beta",
          "limit": {
            "context": 512000,
            "output": 384000
          },
          "modalities": {
            "input": [
              "text"
            ],
            "output": [
              "text"
            ]
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0,
            "cache_write": 0
          }
        },
        "GLM-5.2-NVFP4": {
          "name": "GLM-5.2 NVFP4",
          "family": "glm",
          "release_date": "2026-06-13",
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "status": "beta",
          "limit": {
            "context": 512000,
            "output": 131072
          },
          "modalities": {
            "input": [
              "text"
            ],
            "output": [
              "text"
            ]
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0,
            "cache_write": 0
          }
        },
        "Kimi-K2.7-Code": {
          "name": "Kimi K2.7 Code",
          "family": "kimi-k2",
          "release_date": "2026-06-12",
          "attachment": true,
          "reasoning": true,
          "temperature": false,
          "tool_call": true,
          "status": "beta",
          "limit": {
            "context": 262144,
            "output": 262144
          },
          "modalities": {
            "input": [
              "text",
              "image"
            ],
            "output": [
              "text"
            ]
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0,
            "cache_write": 0
          }
        },
        "Qwen/Qwen3.6-35B-A3B-FP8": {
          "name": "Qwen3.6 35B A3B FP8",
          "family": "qwen",
          "release_date": "2026-04-17",
          "attachment": true,
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "status": "beta",
          "limit": {
            "context": 262144,
            "output": 262144
          },
          "modalities": {
            "input": [
              "text",
              "image"
            ],
            "output": [
              "text"
            ]
          },
          "cost": {
            "input": 0,
            "output": 0,
            "cache_read": 0,
            "cache_write": 0
          }
        }
      }
    }
  }
}
```

The resulting OpenCode model IDs are:

```text
hetzner/DeepSeek-V4-Flash-0731
hetzner/GLM-5.2-NVFP4
hetzner/Kimi-K2.7-Code
hetzner/Qwen/Qwen3.6-35B-A3B-FP8
```

## API facts

- Endpoints: `/v1/models`, `/v1/completions`, and `/v1/chat/completions`
- Experimental access is currently free of charge.
- Per-key limits per 60 seconds: 10 million input tokens and 200,000 output tokens; exceeding either returns HTTP `429`.
