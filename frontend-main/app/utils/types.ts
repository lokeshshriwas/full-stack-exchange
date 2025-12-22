
export interface KLine {
    close: string;
    end: string;
    high: string;
    low: string;
    open: string;
    quoteVolume: string;
    start: string;
    trades: string;
    volume: string;
}

export interface Trade {
    "id": number,
    "isBuyerMaker": boolean,
    "price": string,
    "quantity": string,
    "quoteQuantity": string,
    "timestamp": number
}

export interface Depth {
    bids: [string, string][],
    asks: [string, string][],
    lastUpdateId: string
}

export interface Ticker {
    "firstPrice": string,
    "high": string,
    "lastPrice": string,
    "low": string,
    "priceChange": string,
    "priceChangePercent": string,
    "quoteVolume": string,
    "symbol": string,
    "trades": string,
    "volume": string
}

export interface Tradetype {
  id: number;
  isBuyerMaker: boolean;
  price: string;
  quantity: string;
  timestamp: number;
  quoteQuantity: string;
}

export interface CandleData {
  close: string;     
  end: string;      
}

export interface SymbolData {
  symbol: string;    
  data: CandleData[];
}

export interface Balance {
  user_id: number;
  asset_id: number;
  available: string;
  locked: string;
  symbol: string;
  decimals: number;
}

export interface Cryptocurrency {
  symbol: string;
  name: string;
  icon: React.ReactNode;
  decimals: number;
  isStablecoin?: boolean;
}