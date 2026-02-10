import { generateText, tool, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import axios from "axios";
import talib from "talib";
import { z } from "zod";
import 'dotenv/config';

const zai = createOpenAI({
  baseURL: 'https://api.z.ai/api/coding/paas/v4',
  apiKey: 'XXXXX',
});

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchBybitCandles(): Promise<Candle[]> {
  try {
    const response = await axios.get("https://api.bybit.com/v5/market/kline", {
      params: {
        category: "spot",
        symbol: "BTCUSDT",
        interval: "1",
        limit: 80,
      },
    });

    if (response.data.retCode !== 0) {
      throw new Error(`Bybit API error: ${response.data.retMsg}`);
    }

    const candles = response.data.result.list.map((item: string[]) => ({
      timestamp: parseInt(item[0] || "0"),
      open: parseFloat(item[1] || "0"),
      high: parseFloat(item[2] || "0"),
      low: parseFloat(item[3] || "0"),
      close: parseFloat(item[4] || "0"),
      volume: parseFloat(item[5] || "0"),
    }));
    
    // Reverse to get oldest first (chronological order for RSI calculation)
    return candles.reverse();
  } catch (error) {
    console.error("Failed to fetch Bybit candles:", error);
    throw error;
  }
}

function calculateIndicators(candles: Candle[]): Array<Candle & { rsi: number | null; ema: number | null }> {
  const closes = candles.map((c) => c.close);
  
  const rsiResult = talib.execute({
    name: "RSI",
    inReal: closes,
    startIdx: 0,
    endIdx: closes.length - 1,
    optInTimePeriod: 14,
  });
  
  const emaResult = talib.execute({
    name: "EMA",
    inReal: closes,
    startIdx: 0,
    endIdx: closes.length - 1,
    optInTimePeriod: 20,
  });

  const rsiBegin = rsiResult.begIndex;
  const emaBegin = emaResult.begIndex;

  return candles.map((candle, index) => ({
    ...candle,
    rsi: index >= rsiBegin ? rsiResult.result.outReal[index - rsiBegin] : null,
    ema: index >= emaBegin ? emaResult.result.outReal[index - emaBegin] : null,
  }));
}

function formatCandlesAsCSV(candles: Array<Candle & { rsi: number | null; ema: number | null }>): string {
  const headers = ["timestamp", "open", "high", "low", "close", "volume", "rsi", "ema"];
  const rows = candles.map((c) => [
    c.timestamp,
    c.open.toFixed(2),
    c.high.toFixed(2),
    c.low.toFixed(2),
    c.close.toFixed(2),
    c.volume.toFixed(8),
    c.rsi !== null ? c.rsi.toFixed(2) : "",
    c.ema !== null ? c.ema.toFixed(2) : "",
  ]);
  
  return [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
}

const getTradingDataTool = tool({
  description: "Fetch the latest 80 candles of 1-minute BTC/USDT trading data from Bybit including RSI (14) and EMA (20) technical indicators calculated using TA-Lib. Returns CSV format with columns: timestamp;open;high;low;close;volume;rsi;ema",
  inputSchema: z.object({}),
  execute: async () => {
    console.log("📊 Fetching trading data from Bybit...");
    const candles = await fetchBybitCandles();
    const candlesWithIndicators = calculateIndicators(candles);
    const csvData = formatCandlesAsCSV(candlesWithIndicators);
    console.log(`✅ Trading data fetched: ${candles.length} candles`);
    return { 
      csvData, 
      candleCount: candles.length,
      timestamp: new Date().toISOString()
    };
  },
});

const buyOrderTool = tool({
  description: "Trigger a buy order for Bitcoin",
  inputSchema: z.object({
    amount: z.number().describe("The amount in USD to buy Bitcoin with"),
  }),
  execute: async ({ amount }) => {
    console.log("🚀 BUY ORDER TRIGGERED! 🚀");
    console.log(`💰 Amount: $${amount}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log("=".repeat(50));
    return { status: "success", message: "Buy order executed", amount, timestamp: new Date().toISOString() };
  },
});

async function analyzeAndTrade() {
  try {
    console.log("\n🤖 Starting AI trading analysis...");
    
    const result = await generateText({
      model: zai.chat("GLM-4.7"),
      system: `You are a trading bot analyzing Bitcoin price data.

YOUR TASK:
1. Call the getTradingData tool to fetch the current BTC/USDT trading data
2. Once you receive the CSV data, analyze the RSI values in the most recent (last) candles
3. Look at the LAST row of the CSV - this is the latest candle with the most recent RSI value
4. If the latest RSI is BELOW 30, trigger a buy order using the buyOrder tool with amount: 100
5. If the RSI is 30 or above, do not buy and explain why

The CSV format is: timestamp;open;high;low;close;volume;rsi;ema
The data is ordered from oldest (first row) to newest (last row).`,
      prompt: `Fetch the trading data and make a trading decision based on the RSI. Current timestamp: ${new Date().toISOString()}`,
      tools: {
        getTradingData: getTradingDataTool,
        buyOrder: buyOrderTool,
      },
      stopWhen: stepCountIs(5), // Allow up to 5 steps for multi-step tool calling
      onStepFinish: async ({ usage, finishReason, toolCalls, toolResults }) => {
        console.log(`\n  📍 Step completed:`);
        console.log(`     Tokens: ${usage.inputTokens} in / ${usage.outputTokens} out`);
        console.log(`     Finish reason: ${finishReason}`);
        if (toolCalls && toolCalls.length > 0) {
          console.log(`     Tools called: ${toolCalls.map(tc => tc.toolName).join(', ')}`);
        }
        if (toolResults && toolResults.length > 0) {
          console.log(`     Tool results received: ${toolResults.map(tr => tr.toolName).join(', ')}`);
        }
      },
    });

    console.log("\n📝 Final AI Response:");
    console.log(result.text);
    console.log(`\n📊 Total steps executed: ${result.steps?.length || 0}`);

  } catch (error) {
    console.error("❌ Error in analyzeAndTrade:", error);
  }
}

async function runBot() {
  console.log("\n" + "=".repeat(50));
  console.log(`⏰ Run started at: ${new Date().toISOString()}`);
  
  await analyzeAndTrade();
  
  console.log(`✅ Run completed. Next run in 60 seconds...`);
  console.log("=".repeat(50) + "\n");
  
  setTimeout(runBot, 60000);
}

async function main() {
  console.log("🤖 AI Trading Bot Starting...");
  console.log("📡 Provider: Z.AI (GLM-4.7)");
  console.log("📊 Exchange: Bybit BTC/USDT 1m candles");
  console.log("⏱️  Interval: Every 60 seconds (after completion)");
  console.log("🛠️  Tools: getTradingData, buyOrder (RSI < 30 trigger, $100 USD)");
  console.log("🔁 Multi-step: stopWhen: stepCountIs(5)\n");

  runBot();
}

main();
