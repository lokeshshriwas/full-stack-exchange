import { Ticker } from "./types";

export const PROXY_URL = "wss://ws.backpack.exchange/";
export const BASE_URL = "ws://localhost:3001";

export class SignalingManager {
  private proxyWs: WebSocket;
  private ws: WebSocket;
  private static instance: SignalingManager;
  private proxyBufferedMessages: any[] = [];
  private baseBufferedMessages: any[] = [];
  private callbacks: any = {};
  private id: number;
  private initializedBase: boolean = false;
  private initializedProxy: boolean = false;

  private constructor() {
    this.proxyWs = new WebSocket(PROXY_URL);
    this.ws = new WebSocket(BASE_URL);
    this.proxyBufferedMessages = [];
    this.baseBufferedMessages = [];
    this.id = 1;
    this.init();
  }

  public static getInstance() {
    if (!this.instance) {
      this.instance = new SignalingManager();
    }
    return this.instance;
  }

  init() {
    this.proxyWs.onopen = () => {
      this.initializedProxy = true;
      this.proxyBufferedMessages.forEach((message) => {
        this.proxyWs.send(JSON.stringify(message));
      });
      this.proxyBufferedMessages = [];
    };

    this.proxyWs.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const type = message.data.e;
      if (this.callbacks[type]) {
        this.callbacks[type].forEach(({ callback }: any) => {
          if (type === "ticker") {
            const newTicker: Partial<Ticker> = {
              lastPrice: message.data.c,
              high: message.data.h,
              low: message.data.l,
              volume: message.data.v,
              quoteVolume: message.data.V,
              symbol: message.data.s,
            };
            callback(newTicker);
          }
          if (type === "kline") {
            const newKline = {
              close: message.data.c,
              high: message.data.h,
              low: message.data.l,
              open: message.data.o,
              timestamp: message.data.t,
              start: message.data.t,
              end: message.data.T,
              trades: message.data.n,
              volume: message.data.v,
            };
            callback(newKline);
          }
        });
      }
    };

    this.proxyWs.onerror = (error) => {
      console.error("Proxy WebSocket error:", error);
    };

    this.proxyWs.onclose = () => {
      console.log("Proxy WebSocket closed");
      this.initializedProxy = false;
    };

    this.ws.onopen = () => {
      this.initializedBase = true;
      this.baseBufferedMessages.forEach((message) => {
        this.ws.send(JSON.stringify(message));
      });
      this.baseBufferedMessages = [];
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const type = message.data.e;
      if (this.callbacks[type]) {
        this.callbacks[type].forEach(({ callback }: any) => {
          if (type === "depth") {
            // Backend now sends 'bids' and 'asks' directly
            const updatedBids = message.data.bids || [];
            const updatedAsks = message.data.asks || [];
            callback({ bids: updatedBids, asks: updatedAsks });
          }
          if (type === "trade") {
            const newTrade = {
              price: message.data.p,
              quantity: message.data.q,
              id: message.data.t,
              isBuyerMaker: message.data.m,
              timestamp: Date.now(),
              quoteQuantity: message.data.Q,
            };
            callback(newTrade);
          }
        });
      }
    };

    this.ws.onerror = (error) => {
      console.error("Base WebSocket error:", error);
    };

    this.ws.onclose = () => {
      console.log("Base WebSocket closed");
      this.initializedBase = false;
    };
  }

  sendMessage(message: any) {
    const messageToSend = {
      ...message,
      id: this.id++,
    };

    const isProxyMessage =
      messageToSend.params &&
      messageToSend.params[0] &&
      (messageToSend.params[0].startsWith("ticker.") ||
        messageToSend.params[0].startsWith("kline."));

    if (isProxyMessage) {
      if (!this.initializedProxy) {
        this.proxyBufferedMessages.push(messageToSend);
        return;
      }
      this.proxyWs.send(JSON.stringify(messageToSend));
    } else {
      if (!this.initializedBase) {
        this.baseBufferedMessages.push(messageToSend);
        return;
      }
      this.ws.send(JSON.stringify(messageToSend));
    }
  }

  async registerCallback(type: string, callback: any, id: string) {
    this.callbacks[type] = this.callbacks[type] || [];
    this.callbacks[type].push({ callback, id });
  }

  async deRegisterCallback(type: string, id: string) {
    if (this.callbacks[type]) {
      const index = this.callbacks[type].findIndex(
        (callback: any) => callback.id === id
      );
      if (index !== -1) {
        this.callbacks[type].splice(index, 1);
      }
    }
  }
}