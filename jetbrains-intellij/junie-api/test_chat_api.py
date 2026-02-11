#!/usr/bin/env python3
"""
Test script for Junie Chat API - simple list of working requests.

Usage:
    python3 test_chat_api.py
"""

import urllib.request
import json
import os

# Configuration - Replace with your actual perm-token
TOKEN = "perm-XXX"
BASE_URL = "https://ingrazzio-for-junie-cloud-prod.labs.jb.gg"

TOKEN = os.environ.get("JUNIE_API_KEY", TOKEN)


# List of working test requests
TESTS = [
    {
        "name": "Simple Chat - OpenAI Mini",
        "url": BASE_URL,
        "headers": {
            'Authorization': f'Bearer {TOKEN}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-LLM-Model': 'openai'
        },
        "body": {
            "model": "gpt-4.1-mini-2025-04-14",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant. Respond briefly."},
                {"role": "user", "content": "Say 'Hello World' in JSON format with a 'message' field."}
            ],
            "temperature": 0.0,
            "stream": False
        }
    },
    {
        "name": "Anthropic - Root Endpoint",
        "url": f"{BASE_URL}/",
        "headers": {
            'Authorization': f'Bearer {TOKEN}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'ktor-client',
            'X-LLM-Model': 'anthropic'
        },
        "body": {
            "model": "claude-sonnet-4-5-20250929",
            "messages": [
                {"role": "user", "content": "Say 'Hello World' - keep it brief!"}
            ],
            "max_tokens": 100
        }
    },
    {
        "name": "Grok - v1/responses",
        "url": f"{BASE_URL}/v1/responses",
        "headers": {
            'Authorization': f'Bearer {TOKEN}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'ktor-client',
            'Openai-Version': '2020-11-07',
            'X-Keep-Path': 'true',
            'X-LLM-Model': 'grok'
        },
        "body": {
            "model": "grok-4-1-fast-reasoning",
            "input": [
                {"role": "system", "content": "You are a helpful assistant. Respond very briefly."},
                {"role": "user", "content": "Say 'Hello World'"}
            ],
            "tools": [],
            "include": [],
            "truncation": "auto",
            "parallel_tool_calls": False,
            "stream": False,
            "text": {},
            "store": False
        }
    },
]


def execute_test(test):
    """Execute a single test request."""
    print("\n" + "=" * 60)
    print(f"Test: {test['name']}")
    print("=" * 60)

    url = test['url']
    headers = test['headers']
    body = test['body']

    try:
        print(f"\nPOST {url}")
        print(f"Headers: {json.dumps({k: v[:30] + '...' if len(str(v)) > 30 else v for k, v in headers.items()}, indent=2)}")
        print(f"Body: {json.dumps(body, indent=2)}\n")

        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode('utf-8'),
            headers=headers
        )

        response = urllib.request.urlopen(req, timeout=60)
        result = json.loads(response.read().decode())

        print("✅ SUCCESS!")
        print("\nResponse:")
        result_str = json.dumps(result, indent=2)
        if len(result_str) > 3000:
            print(result_str[:3000] + "\n... (truncated)")
        else:
            print(result_str)

        return True

    except urllib.error.HTTPError as e:
        print(f"❌ HTTP Error: {e.code} - {e.reason}")
        try:
            error_body = e.read().decode()
            print(f"Error details: {error_body[:500]}")
        except:
            pass
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def main():
    """Run all tests."""
    print("Running all tests...\n")

    results = []
    for test in TESTS:
        success = execute_test(test)
        results.append((test['name'], success))

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    for name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {name}")
    print("=" * 60)


if __name__ == "__main__":
    main()
