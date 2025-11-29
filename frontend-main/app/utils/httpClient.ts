import axios from "axios";
import { Depth, KLine, SymbolData, Ticker, Trade } from "./types";
import { getStartAndEndTime } from "./helper";

const BASE_URL = "http://localhost:8080/api/v1";
const BASE_URL_S = "http://localhost:8080";

// Fixed: Returns Ticker[] (array), not Ticker (single object)
export async function getTickers(): Promise<Ticker[]> {
  const response = await axios.get(`${BASE_URL}/tickers`);
  return response.data;
}

export async function getTicker(market: string): Promise<Ticker> {
  const tickers = await getTickers();
  const ticker = tickers.find((t) => t.symbol === market);
  if (!ticker) {
    throw new Error(`No ticker found for ${market}`);
  }
  return ticker;
}

export async function getDepth(market: string): Promise<Depth> {
  const response = await axios.get(`${BASE_URL}/depth?symbol=${market}`);
  return response.data;
}

export async function getTrades(market: string): Promise<Trade[]> {
  const response = await axios.get(`${BASE_URL}/trades?symbol=${market}`);
  return response.data;
}

export async function getKlines(
  market: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<KLine[]> {
  const response = await axios.get(
    `${BASE_URL}/klines?symbol=${market}&interval=${interval}&startTime=${startTime}&endTime=${endTime}`
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
    `${BASE_URL_S}/wapi/v1/marketDataKlines?interval=6h&startTime=${startTime}&endTime=${endTime}`
  );
  const data: SymbolData[] = response.data;
  return data;
}
