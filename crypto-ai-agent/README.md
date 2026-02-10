# AI Trading Agent

*Created: 2026-02-10*

**Built with AI SDK v6** - demonstrating agent tool chaining patterns.

**Note: This is a project example demonstrating the concept, not a production-ready trading system.**

A TypeScript agent that pipes prompts to an LLM with tools for fetching technical data. Based on market properties, it triggers automatic orders via tools — demonstrating tool chaining in sequential steps.

## Features

- Fetches 80 candles of 1-minute BTC/USDT data from Bybit
- Calculates RSI (14-period) and EMA (20-period) using TA-Lib
- Sends data to AI for analysis every 60 seconds
- Triggers buy orders when RSI < 30 (oversold condition)
- Tool-based architecture with proper descriptions for AI SDK

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run the bot:
```bash
npm start
```

## Configuration

## How It Works (Tool Chaining)

1. **Tool 1 - Data Collection**: Fetches last 80 1-minute candles from Bybit
2. **Technical Analysis**: Calculates RSI and EMA using TA-Lib
3. **LLM Prompt**: Pipes data + context to LLM as a prompt
4. **Tool 2 - Order Execution**: LLM chains to `buyOrder` tool when conditions are met
5. **Scheduling**: Runs every 60 seconds in a loop
