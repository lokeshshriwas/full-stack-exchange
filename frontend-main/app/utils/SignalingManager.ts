import { Ticker } from "./types";
import { env } from "../config/env";

export const PROXY_URL = "wss://ws.backpack.exchange/";

// Helper to get cookie value
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift() || null;
    return cookieValue;
  }

  return null;
}

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
  private authenticated: boolean = false;
  private authenticatedUserId: string | null = null;

  private constructor() {
    // env.wsUrl is now a getter that evaluates at runtime (fixed in env.ts)
    const wsUrl = env.wsUrl;
    console.log('[SignalingManager] Connecting to custom WS at:', wsUrl);

    this.proxyWs = new WebSocket(PROXY_URL);
    this.ws = new WebSocket(wsUrl);
    this.proxyBufferedMessages = [];
    this.baseBufferedMessages = [];
    this.id = 1;
    this.init();
  }

  public static getInstance() {
    // SSR guard - WebSocket is not available on server
    if (typeof window === 'undefined') {
      throw new Error('SignalingManager can only be used in browser environment');
    }
    if (!this.instance) {
      this.instance = new SignalingManager();
    }
    return this.instance;
  }

  // Public method to check if authenticated
  public isAuthenticated(): boolean {
    return this.authenticated;
  }

  public getAuthenticatedUserId(): string | null {
    return this.authenticatedUserId;
  }

  // Authenticate with JWT from localStorage (cross-domain workaround)
  public authenticate() {
    const accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;

    if (!accessToken && !refreshToken) {
      return;
    }

    const authMessage = {
      method: 'AUTH',
      params: [accessToken, refreshToken]
    };

    if (!this.initializedBase) {
      this.baseBufferedMessages.push(authMessage);
      return;
    }

    this.ws.send(JSON.stringify(authMessage));
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
      this.initializedProxy = false;
    };

    this.ws.onopen = () => {
      this.initializedBase = true;

      // Send buffered messages
      this.baseBufferedMessages.forEach((message) => {
        this.ws.send(JSON.stringify(message));
      });
      this.baseBufferedMessages = [];

      // Auto-authenticate if we have a token
      this.authenticate();
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      // Handle authentication response
      if (message.type === 'auth_success') {
        this.authenticated = true;
        this.authenticatedUserId = message.userId;

        // Trigger auth callback if registered
        if (this.callbacks['auth_success']) {
          this.callbacks['auth_success'].forEach(({ callback }: any) => {
            callback(message);
          });
        }
        return;
      }

      // Handle error messages
      if (message.type === 'error') {
        if (this.callbacks['error']) {
          this.callbacks['error'].forEach(({ callback }: any) => {
            callback(message);
          });
        }
        return;
      }

      const type = message.data?.e || message.data?.type;

      if (this.callbacks[type]) {
        this.callbacks[type].forEach(({ callback }: any) => {
          if (type === "depth") {
            // Backend now sends 'bids' and 'asks' directly
            const updatedBids = message.data.bids || [];
            const updatedAsks = message.data.asks || [];
            callback({ bids: updatedBids, asks: updatedAsks });
          }
          if (type === "trade") {
            if (message.data.trades) {
              const newTrades = message.data.trades.map((t: any) => ({
                price: t.p,
                quantity: t.q,
                id: t.t,
                isBuyerMaker: t.m,
                timestamp: t.T || Date.now(),
                quoteQuantity: (Number(t.q) * Number(t.p)).toFixed(6), // Use Number and toFixed
              }));
              callback(newTrades);
            } else {
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
          }
          // Handle open orders messages (taker and maker notifications)
          if (type === "ORDER_PLACED" || type === "ORDER_CANCELLED" || type === "ORDER_FILL" || type === "BALANCE_UPDATE") {
            callback(message.data);
          }
        });
      }
    };

    this.ws.onerror = (error) => {
      console.error("Base WebSocket error:", error);
    };

    this.ws.onclose = () => {
      this.initializedBase = false;
      this.authenticated = false;
      this.authenticatedUserId = null;
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
      // Check both initialized flag AND WebSocket readyState for production reliability
      if (!this.initializedProxy || !this.proxyWs || this.proxyWs.readyState !== WebSocket.OPEN) {
        this.proxyBufferedMessages.push(messageToSend);
        return;
      }
      this.proxyWs.send(JSON.stringify(messageToSend));
    } else {
      // Check both initialized flag AND WebSocket readyState for production reliability
      if (!this.initializedBase || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
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
