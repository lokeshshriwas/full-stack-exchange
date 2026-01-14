import axios from "axios";
import { Depth, KLine, SymbolData, Ticker, Trade } from "./types";
import { getStartAndEndTime } from "./helper";
import { env } from "../config/env";

const PROXY_BASE_URL = env.apiV1;
const SPECIAL_BASE_URL = env.apiUrl;
const BASE_URL = env.apiV2;

// Fixed: Returns Ticker[] (array), not Ticker (single object)
export async function getTickers(): Promise<Ticker[]> {
  const response = await axios.get(`${PROXY_BASE_URL}/tickers`);
  return response.data.filter((t: Ticker) => !t.symbol.endsWith("PERP") && !t.symbol.endsWith("PREDICTION"));
}

export async function getTicker(market: string): Promise<Ticker> {
  const tickers = await getTickers();
  const ticker = tickers.find((t) => t.symbol === market);
  if (!ticker) {
    throw new Error(`No ticker found for ${market}`);
  }
  return ticker;
}

export async function getKlines(
  market: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<KLine[]> {
  const response = await axios.get(
    `${PROXY_BASE_URL}/klines?symbol=${market}&interval=${interval}&startTime=${startTime}&endTime=${endTime}`
  );
  const data: KLine[] = response.data;
  return data.sort((x, y) => (Number(x.end) < Number(y.end) ? -1 : 1));
}

export async function getMarkets(): Promise<string[]> {
  const response = await axios.get(`${BASE_URL}/markets`);
  return response.data;
}

export async function marketDataKlines(): Promise<SymbolData[]> {
  const { startTime, endTime } = getStartAndEndTime(7, 1);
  const response = await axios.get(
    `${SPECIAL_BASE_URL}/wapi/v1/marketDataKlines?interval=6h&startTime=${startTime}&endTime=${endTime}`
  );
  const data: SymbolData[] = response.data;
  return data;
}
