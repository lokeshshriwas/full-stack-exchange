# ARCHITECTURE.md - Real-Time Trading Platform Internal Documentation

**Version:** 1.2  
**Last Updated:** 2026-01-07  
**Classification:** Internal Engineering Reference

---

## High-Level System Overview

This document describes the architecture of a real-time, production-grade exchange/trading platform. The system handles order matching, balance management, and real-time data distribution with low-latency requirements suitable for financial applications.

### ASCII Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  FRONTEND                                        │
│                    (Next.js + WebSocket Client via SignalingManager)             │
└─────────────────────────────────────────┬───────────────────────────────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │ HTTP (Port 8080)    │ WebSocket (Port 3001)│
                    ▼                     ▼                      │
┌───────────────────────────────┐  ┌─────────────────────────────┐
│         API SERVER            │  │      WS GATEWAY             │
│  Express + Proxy Middleware   │  │   UserManager + User        │
│     Routes: order, depth,     │  │   SubscriptionManager       │
│     balances, trades, auth    │  │                             │
└───────────────┬───────────────┘  └─────────────┬───────────────┘
                │                                │
                │ Redis LPUSH "messages"         │ Redis SUBSCRIBE
                │ Redis SUBSCRIBE (response)     │ (depth@, trade@, open_orders:user:)
                ▼                                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    REDIS                                         │
│                                                                                  │
│  Queues:           │  Pub/Sub Channels:       │  K/V Store:                      │
│  ├─ messages       │  ├─ depth@{market}       │  ├─ balances:{userId}:{asset}    │
│  ├─ db_processor   │  ├─ trade@{market}       │  ├─ orderbook_snapshot:{market}  │
│  └─ db_balance_    │  ├─ open_orders:user:    │  ├─ depth_snapshot:{market}      │
│     updates        │  │    {userId}           │  └─ trades_snapshot:{market}     │
│                    │  └─ {clientId} (api resp)│     (List - last 100)            │
└────────────────────┴──────────────────────────┴──────────────────────────────────┘
                │
                │ Redis RPOP "messages" (loop)
                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MATCHING ENGINE                                     │
│                                                                                  │
│  Engine.ts                           │  Orderbook.ts                             │
│  ├─ process() - message router       │  ├─ addOrder() - order insertion          │
│  ├─ createOrder() - order flow       │  ├─ matchBid() - buy matching             │
│  ├─ checkAndLockFunds()              │  ├─ matchAsk() - sell matching            │
│  ├─ updateBalance()                  │  ├─ getDepth() - L2 aggregation           │
│  ├─ publishWs*() - WS broadcasts     │  ├─ cancelBid/Ask() - order cancel        │
│  └─ saveSnapshot() - periodic save   │  └─ getOpenOrders() - user orders         │
└───────────────────────────────────────┴──────────────────────────────────────────┘
                │
                │ Redis LPUSH "db_processor", "db_balance_updates"
                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DB WORKER (db/src/index.ts)                            │
│                                                                                  │
│  processTrades():                    │  processBalances():                       │
│  ├─ TRADE_ADDED → trades table       │  ├─ Ledger insert                         │
│  ├─ ORDER_PLACED → orders table      │  └─ Balances upsert                       │
│  ├─ ORDER_UPDATE → orders update     │                                           │
│  ├─ ORDER_CANCELLED → status update  │                                           │
│  └─ SNAPSHOT_SAVED → orderbook save  │                                           │
└───────────────────────────────────────┴──────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              POSTGRESQL                                          │
│                                                                                  │
│  Tables:                                                                         │
│  ├─ users (id, full_name, email, password)                                       │
│  ├─ assets (id, symbol, decimals)                                                │
│  ├─ balances (user_id, asset_id, available, locked)                              │
│  ├─ balance_ledger (history of all balance changes)                              │
│  ├─ orders (id, user_id, symbol, price, qty, side, filled, status)               │
│  ├─ trades (symbol, price, qty, isBuyerMaker, trade_id, order_id, ts)            │
│  ├─ recent_trades (market, trade_id, trade_json) - last 100 per market           │
│  └─ orderbook_snapshots (market, bids, asks, last_trade_id)                      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Component Summary

| Component  | Location          | Port | Responsibility                                        |
| ---------- | ----------------- | ---- | ----------------------------------------------------- |
| Frontend   | `frontend-main/`  | 3000 | UI, WebSocket client, order submission                |
| API Server | `api/src/`        | 8080 | HTTP REST, proxy to external tickers, Redis messaging |
| WS Gateway | `ws/src/`         | 3001 | WebSocket connections, subscriptions, auth            |
| Engine     | `engine/src/`     | N/A  | Order matching, balance ops, state management         |
| DB Worker  | `db/src/index.ts` | N/A  | Async persistence to PostgreSQL                       |
| PostgreSQL | External          | 5432 | Durable storage                                       |
| Redis      | External          | 6379 | Real-time state, pub/sub, queues                      |

---

## Section 1: Market Subscriptions (Tickers and Klines)

### Data Source

External market data is proxied from `wss://ws.backpack.exchange/` (configured via `PROXY_URL` in `SignalingManager.ts`). The API server also proxies HTTP requests to `TARGET_URL` for ticker data used to initialize supported markets.

### Subscription Flow

```
Frontend                    SignalingManager           Backpack Exchange
   │                              │                           │
   │ SUBSCRIBE ticker.SOL_USDC    │                           │
   ├─────────────────────────────►│                           │
   │                              │ WebSocket Subscribe       │
   │                              ├──────────────────────────►│
   │                              │◄──────────────────────────┤
   │                              │ ticker update message     │
   │◄─────────────────────────────┤                           │
   │ Normalized Ticker object     │                           │
```

### SignalingManager Implementation (`frontend-main/app/utils/SignalingManager.ts`)

```typescript
// Dual WebSocket architecture
private proxyWs: WebSocket;  // wss://ws.backpack.exchange/ (tickers, klines)
private ws: WebSocket;       // ws://localhost:3001 (depth, trades, orders)

// Message routing logic in sendMessage():
const isProxyMessage = messageToSend.params[0].startsWith("ticker.") ||
                       messageToSend.params[0].startsWith("kline.");
```

### Message Normalization

Raw ticker message transformed to `Ticker` interface:

```typescript
// Raw from Backpack
{ data: { e: "ticker", c: "100.50", h: "105", l: "98", v: "10000", V: "1000000", s: "SOL_USDC" }}

// Normalized
{
  lastPrice: message.data.c,
  high: message.data.h,
  low: message.data.l,
  volume: message.data.v,
  quoteVolume: message.data.V,
  symbol: message.data.s
}
```

### Kline Normalization

```typescript
{
  close: message.data.c,
  high: message.data.h,
  low: message.data.l,
  open: message.data.o,
  timestamp: message.data.t,
  start: message.data.t,
  end: message.data.T,
  trades: message.data.n,
  volume: message.data.v
}
```

### Multi-User Broadcast

The frontend `SignalingManager` maintains individual connections. Each user has their own WebSocket connection to the proxy. There is no server-side fan-out for external market data - each client subscribes directly.

### Reconnection Handling

```typescript
this.proxyWs.onclose = () => {
  this.initializedProxy = false;
  // Messages buffered in proxyBufferedMessages until reconnect
};

this.proxyWs.onopen = () => {
  this.initializedProxy = true;
  this.proxyBufferedMessages.forEach((message) => {
    this.proxyWs.send(JSON.stringify(message));
  });
  this.proxyBufferedMessages = [];
};
```

---

## Section 2: Custom Depth and Trades WebSocket for /trade/{market}

### WebSocket Connection Lifecycle

#### 1. Connection Establishment

```
User opens /trade/SOL_USDC
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ SignalingManager.getInstance()                              │
│   - Creates WebSocket to ws://localhost:3001               │
│   - WebSocketServer receives connection                     │
│   - UserManager.addUser(ws) creates User instance          │
│   - User assigned random ID (e.g., "abc123def456")         │
└─────────────────────────────────────────────────────────────┘
```

#### 2. UserManager.addUser() (`ws/src/UserManager.ts`)

```typescript
public addUser(ws: WebSocket) {
  const id = this.getRandomId();  // Math.random().toString(36)...
  const user = new User(id, ws);
  this.users.set(id, user);
  this.registerOnClose(ws, user);  // Cleanup on disconnect
  return user;
}
```

#### 3. Subscription Message

Frontend sends:

```json
{ "method": "SUBSCRIBE", "params": ["depth@SOL_USDC", "trade@SOL_USDC"] }
```

#### 4. SubscriptionManager.subscribe() (`ws/src/SubscriptionManager.ts`)

```typescript
public async subscribe(userId: string, subscription: string, authenticatedUserId: string | null = null) {
  // Track user->subscription mapping
  this.subscriptions.set(userId, [...existing, subscription]);

  // Track subscription->users mapping (for broadcast)
  this.reverseSubscriptions.set(subscription, [...existing, userId]);

  // First subscriber triggers Redis subscription
  if (this.reverseSubscriptions.get(subscription)?.length === 1) {
    this.redisClient.subscribe(subscription, this.redisCallbackHandler);
  }

  // Send initial snapshot for depth
  if (subscription.startsWith("depth@")) {
    const snapshot = await this.redisClientKV.get(`depth_snapshot:${market}`);
    UserManager.getInstance().getUser(userId)?.emit({
      stream: subscription,
      data: { e: "depth", bids: parsedSnapshot.bids, asks: parsedSnapshot.asks }
    });
  }

  // Send initial trades history
  if (subscription.startsWith("trade@")) {
    const tradesStrings = await this.redisClientKV.lRange(`trades_snapshot:${market}`, 0, -1);
    // Send as batch
  }
}
```

### Initial Snapshot vs Incremental Updates

| Data Type | Snapshot Source                                   | Incremental Source             |
| --------- | ------------------------------------------------- | ------------------------------ |
| Depth     | `depth_snapshot:{market}` (Redis String)          | Redis Pub/Sub `depth@{market}` |
| Trades    | `trades_snapshot:{market}` (Redis List, last 100) | Redis Pub/Sub `trade@{market}` |

### Depth Message Schema

```typescript
// Initial snapshot (full book)
{
  stream: "depth@SOL_USDC",
  data: {
    e: "depth",
    bids: [["100.50", "5.5"], ["100.00", "10.2"]],  // [price, quantity]
    asks: [["101.00", "3.0"], ["101.50", "8.1"]]
  }
}

// Incremental update (changed levels only)
{
  stream: "depth@SOL_USDC",
  data: {
    e: "depth",
    bids: [["100.50", "0"]],  // "0" means level removed
    asks: [["101.00", "5.5"]]
  }
}
```

### Trade Message Schema

```typescript
// Single trade
{
  stream: "trade@SOL_USDC",
  data: {
    e: "trade",
    t: 12345,           // tradeId
    m: true,            // isBuyerMaker
    p: "100.50",        // price
    q: "2.5",           // quantity
    s: "SOL_USDC",      // market
    T: 1704189186000    // timestamp
  }
}
```

### Orderbook Depth Calculation (`engine/src/trade/Orderbook.ts`)

```typescript
getDepth() {
  const bidsObj: { [key: string]: number } = {};
  const asksObj: { [key: string]: number } = {};

  // Aggregate quantities at each price level
  for (const order of this.bids) {
    const remaining = order.quantity - order.filled;
    bidsObj[order.price] = (bidsObj[order.price] || 0) + remaining;
  }

  for (const order of this.asks) {
    const remaining = order.quantity - order.filled;
    asksObj[order.price] = (asksObj[order.price] || 0) + remaining;
  }

  // Convert to array format
  return {
    bids: Object.entries(bidsObj).map(([p, q]) => [p, q.toString()]),
    asks: Object.entries(asksObj).map(([p, q]) => [p, q.toString()])
  };
}
```

### Race Condition Prevention

1. **Single-threaded Engine**: The matching engine runs in a single Node.js event loop, processing one message at a time from the `messages` queue.

2. **Atomic Redis Operations**: Balance updates use Lua scripts for atomicity:

```lua
-- From engine/src/RedisManager.ts updateBalance()
local currentAvailable = tonumber(redis.call("HGET", key, "available") or "0")
local currentLocked = tonumber(redis.call("HGET", key, "locked") or "0")

local newAvailable = currentAvailable + availableChange
local newLocked = currentLocked + lockedChange

if newAvailable < 0 or newLocked < 0 then
    return nil  -- Reject insufficient funds
end

redis.call("HSET", key, "available", newAvailable, "locked", newLocked)
```

3. **Sequential Message Processing**:

```typescript
// engine/src/index.ts
while (true) {
  const response = await redisClient.rPop("messages");
  if (response) {
    await engine.process(JSON.parse(response)); // Fully await before next
  }
}
```

### Disconnect Handling

```typescript
// ws/src/UserManager.ts
private registerOnClose(ws: WebSocket, user: User) {
  ws.on("close", () => {
    this.users.delete(user.getId());
    SubscriptionManager.getInstance().userLeft(userId);
  });
}

// ws/src/SubscriptionManager.ts
public userLeft(userId: string) {
  this.subscriptions.get(userId)?.forEach((s) => this.unsubscribe(userId, s));
}

public unsubscribe(userId: string, subscription: string) {
  // Remove from mappings
  // If last subscriber, unsubscribe from Redis channel
  if (this.reverseSubscriptions.get(subscription)?.length === 0) {
    this.redisClient.unsubscribe(subscription);
  }
}
```

---

## Section 3: Open Orders WebSocket

### User-Specific Channel Architecture

Each authenticated user has a dedicated Redis Pub/Sub channel: `open_orders:user:{userId}`

### Authentication Flow

```
Frontend                    WS Gateway                    Redis
   │                           │                            │
   │ AUTH [jwt_token]          │                            │
   ├──────────────────────────►│                            │
   │                           │ jwt.verify(token)          │
   │                           │ authenticatedUserId = X    │
   │◄──────────────────────────┤                            │
   │ auth_success, userId: X   │                            │
   │                           │                            │
   │ SUBSCRIBE open_orders:    │                            │
   │   user:X                  │                            │
   ├──────────────────────────►│                            │
   │                           │ validateUserScopedSub()    │
   │                           │ (requestedId === authId?)  │
   │                           │ SUBSCRIBE channel          │
   │                           ├───────────────────────────►│
```

### User.ts Authentication Handling

```typescript
if (parsedMessage.method === AUTH) {
  const accessToken = parsedMessage.params[0];
  const refreshToken = parsedMessage.params[1];

  try {
    // IMPORTANT: userId may be number or string depending on JWT payload
    // Always convert to string for consistent channel comparison
    const decoded = jwt.verify(accessToken, JWT_SECRET) as {
      userId: number | string;
    };
    this.authenticated = true;
    this.authenticatedUserId = String(decoded.userId); // Explicit string conversion

    this.ws.send(
      JSON.stringify({
        type: "auth_success",
        userId: this.authenticatedUserId,
      })
    );
  } catch (accessError) {
    // Fallback to refresh token if access token expired
    if (refreshToken) {
      try {
        const decodedRefresh = jwt.verify(refreshToken, REFRESH_SECRET) as {
          userId: number | string;
        };
        this.authenticated = true;
        this.authenticatedUserId = String(decodedRefresh.userId);
        // ... send auth_success
      } catch (refreshError) {
        this.sendError("Invalid authentication token");
      }
    } else {
      this.sendError("Invalid or expired token");
    }
  }
}
```

> **Note (2026-01-07):** The `String(decoded.userId)` conversion is critical because JWTs from the API contain `userId` as a **number**, but channel subscriptions use **string** comparison. Without this conversion, `123 !== "123"` fails and users get "Unauthorized" errors when subscribing to their own order channel.

### User Isolation Enforcement

```typescript
private validateUserScopedSubscription(subscription: string): boolean {
  if (subscription.startsWith("open_orders:user:")) {
    if (!this.authenticated) {
      this.sendError("Authentication required for user-scoped subscriptions");
      return false;
    }

    const requestedUserId = subscription.split(":")[2];
    if (requestedUserId !== this.authenticatedUserId) {
      this.sendError("Unauthorized: Cannot subscribe to another user's channel");
      return false;
    }
  }
  return true;
}
```

### Order Events

#### ORDER_PLACED

Published from `Engine.publishWsOrders()`:

```typescript
{
  stream: "open_orders:user:123",
  data: {
    type: "ORDER_PLACED",
    payload: {
      orderId: "abc123def456xyz789",
      executedQty: 0,
      market: "SOL_USDC",
      price: "100.50",
      quantity: "5.0",
      side: "buy",
      status: "open",  // or "partial", "filled"
      userId: "123",
      timestamp: 1704189186000
    }
  }
}
```

#### ORDER_CANCELLED

Published from `Engine.process()` CANCEL_ORDER handler:

```typescript
{
  stream: "open_orders:user:123",
  data: {
    type: "ORDER_CANCELLED",
    payload: {
      orderId: "abc123def456xyz789",
      market: "SOL_USDC",
      price: "100.50",
      quantity: "5.0",
      filled: 2.0,
      side: "buy",
      remainingQty: 3.0,
      timestamp: 1704189186000
    }
  }
}
```

#### ORDER_FILL (Maker Notification)

Published from `Engine.publishWsOrders()` to notify MAKERS when their orders are filled:

```typescript
{
  stream: "open_orders:user:456",  // Maker's channel
  data: {
    type: "ORDER_FILL",
    payload: {
      orderId: "maker_order_xyz",
      filledQty: 2.5,
      price: "100.50",
      market: "SOL_USDC",
      side: "sell",  // Maker's side (opposite of taker)
      timestamp: 1704189186000
    }
  }
}
```

### Why WebSocket Over Polling

1. **Latency**: Order status updates delivered in ~1-5ms vs 100ms+ polling intervals
2. **Bandwidth**: No repeated HTTP overhead
3. **Real-time fills**: Partial fills visible immediately
4. **Server load**: O(1) per event vs O(users \* polls/sec)

### Duplicate Prevention

- Each order has unique `orderId` (random 26-char string)
- Trades have sequential `tradeId` per orderbook
- Frontend can deduplicate by ID if needed

### Frontend Event-Driven Updates (2026-01-07)

The frontend uses event-driven updates instead of polling for better performance and UX.

#### Balance Updates (`useBalance.ts`)

**Previous (Polling):** Fetched balances every 2 seconds (30 req/min idle)

**Current (Event-Driven):** Only fetches on order events

```typescript
signalingManager.registerCallback("ORDER_PLACED", (data) => {
  // Optimistic update: Lock funds immediately in UI
  setBalances((prev) => {
    if (payload.side === "buy") {
      // Lock quote asset: available ↓, locked ↑
    } else {
      // Lock base asset: available ↓, locked ↑
    }
    return updated;
  });
  // Reconcile with server after 300ms (DB write delay)
  debouncedReconcile();
});

signalingManager.registerCallback("ORDER_CANCELLED", (data) => {
  // Optimistic update: Unlock funds immediately in UI
  const remainingQty = payload.quantity - payload.filled;
  // available ↑, locked ↓
  debouncedReconcile();
});

signalingManager.registerCallback("ORDER_FILL", () => debouncedReconcile());
```

**Why Optimistic Updates:** WebSocket events arrive before DB writes complete. Without optimistic updates, balance shows stale data until next event.

#### Client-Side Balance Validation (`SwapUI.tsx`)

Orders are validated before API call:

```typescript
if (action === "buy") {
  const requiredAmount = numQty * price;
  const availableUsdc = getBalanceForAsset(quoteAsset)?.available || 0;
  if (availableUsdc < requiredAmount) {
    toast.error(`Insufficient ${quoteAsset} balance`);
    return; // Prevent API call
  }
} else {
  const availableBase = getBalanceForAsset(baseAsset)?.available || 0;
  if (availableBase < numQty) {
    toast.error(`Insufficient ${baseAsset} balance`);
    return;
  }
}
```

**Impact:**

- 90% reduction in balance API calls (0 when idle vs 30/min)
- Instant UI updates (<20ms vs 200-2000ms)
- No negative balances from race conditions

---

## Section 4: Redis Engine (CRITICAL SECTION)

### 4.1 Redis Responsibilities

#### State Management

| Purpose              | Redis Structure | Key Pattern                   | TTL                   |
| -------------------- | --------------- | ----------------------------- | --------------------- |
| User balances        | Hash            | `balances:{userId}:{asset}`   | None                  |
| Orderbook snapshot   | String (JSON)   | `orderbook_snapshot:{market}` | None                  |
| Depth snapshot       | String (JSON)   | `depth_snapshot:{market}`     | None                  |
| Recent trades        | List            | `trades_snapshot:{market}`    | None (trimmed to 100) |
| Engine command queue | List            | `messages`                    | None                  |
| DB persistence queue | List            | `db_processor`                | None                  |
| Balance update queue | List            | `db_balance_updates`          | None                  |

#### Key Naming Conventions

```
balances:{userId}:{asset}
  Field: available (string number)
  Field: locked (string number)

orderbook_snapshot:{market}
  Value: JSON { baseAsset, bids, asks, lastTradeId, currentPrice, quoteAsset, trades }

depth_snapshot:{market}
  Value: JSON { bids: [[price, qty]], asks: [[price, qty]] }

trades_snapshot:{market}
  Value: List of JSON trade objects (LIFO, max 100)
```

#### Data Structures

```
Hash: balances:123:USDC
  ├── available: "1000.00"
  └── locked: "250.00"

String: depth_snapshot:SOL_USDC
  └── {"bids":[["100","5"]],"asks":[["101","3"]]}

List: trades_snapshot:SOL_USDC
  ├── [0] {"e":"trade","t":100,"p":"100.5","q":"2",...}
  ├── [1] {"e":"trade","t":99,"p":"100.4","q":"1",...}
  └── ... (max 100 items)

List: messages
  └── {"clientId":"abc123","message":{"type":"CREATE_ORDER",...}}

List: db_processor
  └── {"type":"TRADE_ADDED","data":{...}}
```

### 4.2 Order Execution Logic

#### Complete Order Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORDER CREATION FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

User clicks "Buy"
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Frontend: makeOrder() → POST /api/v2/order                                   │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ API: orderRouter.post("/")                                                   │
│   1. Extract { market, price, quantity, side } from body                     │
│   2. Get userId from JWT (authMiddleware)                                    │
│   3. Fetch DB balances → RedisManager.pushMessage(ENSURE_USER)               │
│   4. RedisManager.sendAndAwait({ type: CREATE_ORDER, data: {...} })          │
│      - Generates unique clientId                                             │
│      - Subscribes to clientId channel for response                           │
│      - LPUSH to "messages" queue                                             │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Engine: main() loop                                                          │
│   response = await redisClient.rPop("messages")                              │
│   await engine.process(JSON.parse(response))                                 │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Engine.process() - CREATE_ORDER case                                         │
│   1. Validate market exists (add if dynamic)                                 │
│   2. Call createOrder(market, price, quantity, side, userId)                 │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Engine.createOrder()                                                         │
│                                                                              │
│   1. Find orderbook for market                                               │
│   2. Generate orderId = random 26-char string                                │
│   3. checkAndLockFunds() ─────────────────────────────────────────────────┐  │
│                                                                           │  │
│   4. Create Order object:                                                 │  │
│      { price, quantity, orderId, filled: 0, side, userId }                │  │
│                                                                           │  │
│   5. orderbook.addOrder(order) ──────────────────────────────────────────┐│  │
│        │                                                                 ││  │
│        ▼                                                                 ││  │
│   ┌──────────────────────────────────────────────────────────────────┐   ││  │
│   │ Orderbook.addOrder()                                             │   ││  │
│   │   if (side === "buy") matchBid(order) else matchAsk(order)       │   ││  │
│   │   if (executedQty < quantity) push to bids/asks array            │   ││  │
│   │   return { fills, executedQty }                                  │   ││  │
│   └──────────────────────────────────────────────────────────────────┘   ││  │
│        │                                                                 ││  │
│        ▼                                                                 ││  │
│   6. updateBalance() ─────────────────────────────────────────────────┐  ││  │
│   7. createDbTrades() - LPUSH to db_processor                         │  ││  │
│   8. updateDbOrders() - LPUSH to db_processor                         │  ││  │
│   9. publishWsDepthUpdates() - PUBLISH to depth@{market}              │  ││  │
│  10. publishWsTrades() - PUBLISH to trade@{market}                    │  ││  │
│  11. publishWsOrders() - PUBLISH to open_orders:user:{userId}         │  ││  │
│                                                                       │  ││  │
│   return { executedQty, fills, orderId }                              │  ││  │
└───────────────────────────────────┬───────────────────────────────────┴──┴┴──┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Engine.process() continues                                                   │
│   RedisManager.sendToApi(clientId, {                                         │
│     type: "ORDER_PLACED",                                                    │
│     payload: { orderId, executedQty, fills }                                 │
│   })                                                                         │
│   - PUBLISH to clientId channel (API is subscribed)                          │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ API: receives response on clientId channel                                   │
│   resolve(JSON.parse(message))                                               │
│   res.json(response.payload)                                                 │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Frontend: receives HTTP response { orderId, executedQty, fills }             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Matching Algorithm (matchBid example)

```typescript
// Orderbook.matchBid() - Taker is BUYING, matches against ASKS
matchBid(order: Order): { fills: Fill[], executedQty: number } {
  const fills: Fill[] = [];
  let executedQty = 0;

  for (let i = 0; i < this.asks.length; i++) {
    // SELF-TRADE PREVENTION: Skip orders from the same user
    if (this.asks[i].userId === order.userId) {
      continue;
    }

    // Price condition: ask price <= order price
    if (this.asks[i].price <= order.price && executedQty < order.quantity) {
      const remainingAskQty = this.asks[i].quantity - this.asks[i].filled;
      const filledQty = Math.min((order.quantity - executedQty), remainingAskQty);

      executedQty += filledQty;
      this.asks[i].filled += filledQty;

      fills.push({
        price: this.asks[i].price.toString(),
        qty: filledQty,
        tradeId: this.lastTradeId++,
        otherUserId: this.asks[i].userId,
        markerOrderId: this.asks[i].orderId
      });

      // Record trade
      this.trades.push({
        price: this.asks[i].price.toString(),
        quantity: filledQty,
        tradeId: fills[fills.length - 1].tradeId,
        timestamp: Date.now(),
        isBuyerMaker: true  // Seller (ask) was maker
      });
    }
  }

  // Remove fully filled asks
  this.asks = this.asks.filter(a => a.filled < a.quantity);

  return { fills, executedQty };
}
```

> [!IMPORTANT] > **Self-Trade Prevention**: The matching algorithm skips orders from the same user (`userId === order.userId`). This prevents users from trading with themselves. The incoming order will rest on the book if no other matching orders exist.

#### Dual-Side Order Persistence

When a trade occurs, BOTH the taker and maker orders are persisted:

1. **Taker Order** (`persistOrderToDb()`): Created with correct `status` (open/partial/filled)
2. **Maker Orders** (`persistMakerFillToDb()`): Updated with incremental fill amount

```typescript
// Engine.createOrder() - Persistence Order
// 1. Persist TAKER order with correct status FIRST
const takerStatus =
  executedQty === numericQuantity
    ? "filled"
    : executedQty > 0
    ? "partial"
    : "open";
this.persistOrderToDb(
  orderId,
  userId,
  market,
  price,
  quantity,
  side,
  executedQty,
  takerStatus
);

// 2. Persist MAKER order updates (incremental fills)
for (const fill of fills) {
  this.persistMakerFillToDb(fill.markerOrderId, fill.qty);
}

// 3. Then create trade records
this.createDbTrades(fills, market, userId, orderId);
```

This ensures order history is visible for **both users** even on immediate fills.

#### Price-Time Priority

Orders are matched in array order. Since orders are pushed to the end, earlier orders (lower index) have priority. For same price, earlier order matches first.

**Note**: Current implementation does NOT maintain sorted order. For production, bids should be sorted descending by price, asks ascending.

#### Waiting Execution (Resting Orders)

```typescript
// Orderbook.addOrder()
if (order.side === "buy") {
  const { executedQty, fills } = this.matchBid(order);
  order.filled = executedQty;

  if (executedQty === order.quantity) {
    return { executedQty, fills }; // Fully filled, don't add to book
  }

  this.bids.push(order); // Partial or no fill, add to book
  return { executedQty, fills };
}
```

Resting orders remain in the `bids[]` or `asks[]` arrays until:

1. They are matched by an incoming order
2. They are cancelled
3. Engine restarts (loaded from snapshot)

### 4.3 Balance and User State Computation

#### Balance Structure

```typescript
// Redis Hash: balances:{userId}:{asset}
{
  available: "1000.00",  // Can be used for new orders
  locked: "250.00"       // Reserved for open orders
}
```

#### Lock Flow (Order Placement)

```typescript
async checkAndLockFunds(baseAsset, quoteAsset, side, userId, price, quantity, orderId) {
  if (side === "buy") {
    const requiredAmount = quantity * price;

    // Atomic update: available -= required, locked += required
    const success = await RedisManager.getInstance().updateBalance(
      userId,
      quoteAsset,      // Lock quote currency (e.g., USDC)
      -requiredAmount, // availableChange
      requiredAmount,  // lockedChange
      "order_place",
      orderId
    );

    if (!success) {
      throw new Error(`Insufficient ${quoteAsset} funds`);
    }
  } else {
    // Sell: lock base asset
    await RedisManager.getInstance().updateBalance(
      userId,
      baseAsset,
      -quantity,
      quantity,
      "order_place",
      orderId
    );
  }
}
```

#### Unlock Flow (Trade Execution)

```typescript
async updateBalance(userId, baseAsset, quoteAsset, side, fills, executedQty, orderPrice, orderId) {
  if (side === "buy") {
    // TAKER is BUYING
    for (const fill of fills) {
      const fillValue = fill.qty * Number(fill.price);

      // Taker: unlock spent quote, receive base
      await RedisManager.getInstance().updateBalance(
        userId, quoteAsset, 0, -fillValue, "trade", fill.tradeId
      );
      await RedisManager.getInstance().updateBalance(
        userId, baseAsset, fill.qty, 0, "trade", fill.tradeId
      );

      // Maker: receive quote, unlock base
      await RedisManager.getInstance().updateBalance(
        fill.otherUserId, quoteAsset, fillValue, 0, "trade", fill.tradeId
      );
      await RedisManager.getInstance().updateBalance(
        fill.otherUserId, baseAsset, 0, -fill.qty, "trade", fill.tradeId
      );
    }
  }
}
```

#### Atomicity Guarantee (Lua Script)

```lua
-- engine/src/RedisManager.ts updateBalance()
local key = KEYS[1]
local queueKey = KEYS[2]

local availableChange = tonumber(ARGV[1])
local lockedChange = tonumber(ARGV[2])
-- ... other args

local currentAvailable = tonumber(redis.call("HGET", key, "available") or "0")
local currentLocked = tonumber(redis.call("HGET", key, "locked") or "0")

local newAvailable = currentAvailable + availableChange
local newLocked = currentLocked + lockedChange

-- Atomic constraint check
if newAvailable < 0 or newLocked < 0 then
    return nil  -- Reject - insufficient funds
end

-- Atomic update
redis.call("HSET", key, "available", newAvailable, "locked", newLocked)

-- Atomic queue push for DB sync
local payload = cjson.encode({...})
redis.call("RPUSH", queueKey, payload)

return {newAvailable, newLocked}
```

#### Idempotency

Each balance update includes `eventId`:

- `orderId` for order placements
- `tradeId` for fills
- Random ID for deposits

The DB worker can use this to prevent double-processing (though current implementation uses INSERT ON CONFLICT).

#### Failure Recovery

**Engine crash recovery:**

1. Engine loads from `orderbook_snapshots` table or `snapshot.json`
2. Redis balances remain intact (Redis persists separately)
3. Pending `db_processor` messages continue processing

**Balance reconciliation:**
API syncs DB balance to Redis before order placement:

```typescript
// api/src/routes/order.ts
RedisManager.getInstance().pushMessage({
  type: ENSURE_USER,
  data: { userId, balances: formattedBalances },
});
```

Engine handles ENSURE_USER:

```typescript
case ENSURE_USER:
  for (const asset in balances) {
    await RedisManager.getInstance().syncBalance(
      userId, asset, balances[asset].available, balances[asset].locked
    );
  }
```

---

## Section 5: PostgreSQL Persistence Layer

### Why PostgreSQL in Addition to Redis

| Concern             | Redis              | PostgreSQL   |
| ------------------- | ------------------ | ------------ |
| Speed               | Sub-millisecond    | 1-10ms       |
| Durability          | Optional RDB/AOF   | Full ACID    |
| Query capability    | Limited            | Full SQL     |
| Historical analysis | Not designed for   | Excellent    |
| Audit trail         | None               | Ledger table |
| Crash recovery      | Possible data loss | Guaranteed   |

### Schema Overview

```sql
-- Core tables
users (id, full_name, email, password, created_at)
assets (id, symbol, decimals)
balances (user_id, asset_id, available, locked, last_updated_at)
balance_ledger (id, user_id, asset, amount_change, locked_change, type, event_id, timestamp)
orders (id, user_id, symbol, price, qty, side, filled, status, created_at)
trades (id, symbol, price, qty, isBuyerMaker, trade_id, order_id, ts)
recent_trades (id, market, trade_id, trade_json, created_at)
orderbook_snapshots (market, bids, asks, last_trade_id, created_at)
```

### What Is Stored

| Table                 | Purpose                | Write Trigger                               |
| --------------------- | ---------------------- | ------------------------------------------- |
| `trades`              | Complete trade history | TRADE_ADDED message                         |
| `orders`              | Order lifecycle        | ORDER_PLACED, ORDER_UPDATE, ORDER_CANCELLED |
| `balances`            | User holdings snapshot | Balance update queue                        |
| `balance_ledger`      | Audit trail            | Balance update queue                        |
| `orderbook_snapshots` | Recovery point         | SNAPSHOT_SAVED (every 3 seconds)            |
| `recent_trades`       | Fast trade loading     | TRADE_ADDED                                 |

### Idempotent ORDER_PLACED Handler

The DB worker uses `GREATEST()` to ensure fills are monotonically increasing even if messages arrive out of order:

```sql
INSERT INTO orders (id, user_id, symbol, price, qty, side, filled, status)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (id) DO UPDATE SET
  filled = GREATEST(orders.filled, EXCLUDED.filled),
  status = CASE
    WHEN GREATEST(orders.filled, EXCLUDED.filled) >= orders.qty THEN 'filled'
    WHEN GREATEST(orders.filled, EXCLUDED.filled) > 0 THEN 'partial'
    ELSE EXCLUDED.status
  END
```

This handles the race condition where ORDER_UPDATE could arrive before ORDER_PLACED for immediately-filled orders.

### Write Timing: Async

All DB writes are asynchronous via worker queues:

```typescript
// Engine pushes to queue
RedisManager.getInstance().pushMessage({
  type: TRADE_ADDED,
  data: { market, id, price, quantity, ... }
});

// DB worker processes
while (true) {
  const response = await client.rPop("db_processor");
  if (response) {
    const data = JSON.parse(response);
    await pgClient.query(insertQuery, values);
  } else {
    await sleep(100);  // Avoid CPU spinning
  }
}
```

### Redis to PostgreSQL Sync

#### Orderbook Snapshots

```typescript
// Engine.saveSnapshot() - runs every 3 seconds
setInterval(() => {
  this.orderbooks.forEach((o) => {
    // Save to Redis for WS clients
    RedisManager.getInstance().set(
      `orderbook_snapshot:${o.ticker()}`,
      JSON.stringify(o.getSnapshot())
    );
    RedisManager.getInstance().set(
      `depth_snapshot:${o.ticker()}`,
      JSON.stringify(o.getDepth())
    );

    // Push to DB queue
    RedisManager.getInstance().pushMessage({
      type: "SNAPSHOT_SAVED",
      data: {
        market: o.ticker(),
        bids: o.bids,
        asks: o.asks,
        lastTradeId: o.lastTradeId,
      },
    });
  });
}, 3000);
```

#### Balance Sync

Lua script pushes to `db_balance_updates` queue on every change.
DB worker processes:

```typescript
// db/src/index.ts processBalances()
const {
  userId,
  asset,
  availableChange,
  lockedChange,
  type,
  eventId,
  timestamp,
} = data;

await pgClient.query("BEGIN");

// 1. Insert ledger entry
await pgClient.query(`INSERT INTO balance_ledger ...`);

// 2. Upsert balance
await pgClient.query(`
  INSERT INTO balances (user_id, asset_id, available, locked, last_updated_at)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (user_id, asset_id)
  DO UPDATE SET
    available = balances.available + $6,
    locked = balances.locked + $7,
    last_updated_at = $8
`);

await pgClient.query("COMMIT");
```

### Redis Rehydration After Restart

```typescript
// Engine.init()
const result = await pgClient.query("SELECT * FROM orderbook_snapshots");
const snapshots = result.rows;

if (snapshots.length > 0) {
  snapshots.forEach((s) => {
    const orderbook = new Orderbook(
      s.market.split("_")[0], // baseAsset
      s.bids,
      s.asks,
      s.last_trade_id,
      0,
      s.market.split("_")[1] // quoteAsset
    );
    this.orderbooks.push(orderbook);
  });

  // Reload recent trades into Redis
  const recentTradesResult = await pgClient.query(
    "SELECT market, trade_json FROM recent_trades ORDER BY created_at ASC"
  );
  for (const row of recentTradesResult.rows) {
    await RedisManager.getInstance().pushToQueue(
      `trades_snapshot:${row.market}`,
      JSON.stringify(tradePayload)
    );
  }
}
```

### Data Consistency Guarantees

1. **Redis → PostgreSQL**: Eventually consistent. Queue provides buffer.
2. **Engine state → Redis**: Immediately consistent (synchronous writes).
3. **PostgreSQL**: ACID transactions for balance updates.

---

## Section 6: End-to-End Event Flow Examples

### Example: User Places a Buy Order

**Scenario**: User 123 places limit buy for 5 SOL @ 100 USDC

#### Timeline

```
T+0ms    Frontend: makeOrder("SOL_USDC", "100", "5", "buy", "123")
         └── POST /api/v2/order

T+1ms    API orderRouter.post():
         ├── authMiddleware → userId = 123
         ├── Fetch DB balances: SELECT ... FROM balances WHERE user_id = 123
         ├── pushMessage(ENSURE_USER, { userId, balances })  [fire-and-forget]
         └── sendAndAwait(CREATE_ORDER, { market, price, quantity, side, userId })
             ├── clientId = "rnd_abc123"
             ├── SUBSCRIBE "rnd_abc123"
             └── LPUSH "messages" → {"clientId":"rnd_abc123","message":{...}}

T+2ms    Engine main loop:
         └── RPOP "messages" → processes message

T+3ms    Engine.process(CREATE_ORDER):
         └── createOrder("SOL_USDC", "100", "5", "buy", "123")

T+4ms    Engine.createOrder():
         ├── orderId = "ord_xyz789"
         ├── checkAndLockFunds():
         │   └── updateBalance(123, USDC, -500, +500, "order_place", "ord_xyz789")
         │       └── Lua script: available 1000→500, locked 0→500
         │       └── RPUSH "db_balance_updates" → ledger entry
         │
         ├── orderbook.addOrder():
         │   └── matchBid() → finds 1 ask @ 99 USDC for 2 SOL
         │       ├── fills = [{ price: "99", qty: 2, tradeId: 100, otherUserId: "456" }]
         │       ├── executedQty = 2
         │       └── order.filled = 2
         │   └── this.bids.push(order)  // remaining 3 SOL @ 100
         │
         ├── updateBalance():
         │   ├── Taker (123) USDC: locked -198 (2*99)
         │   ├── Taker (123) SOL: available +2
         │   ├── Maker (456) USDC: available +198
         │   └── Maker (456) SOL: locked -2
         │
         ├── createDbTrades():
         │   └── LPUSH "db_processor" → TRADE_ADDED
         │
         ├── updateDbOrders():
         │   └── LPUSH "db_processor" → ORDER_UPDATE (taker + maker)
         │
         ├── publishWsDepthUpdates():
         │   └── PUBLISH "depth@SOL_USDC" → {"asks":[["99","0"]],"bids":[["100","3"]]}
         │
         ├── publishWsTrades():
         │   └── PUBLISH "trade@SOL_USDC" → {"e":"trade","t":100,"p":"99",...}
         │   └── LPUSH "trades_snapshot:SOL_USDC"
         │
         └── publishWsOrders():
             └── PUBLISH "open_orders:user:123" → ORDER_PLACED (status: "partial")
             └── PUBLISH "open_orders:user:456" → ORDER_UPDATE (fill notification)

T+5ms    Engine.process() continues:
         └── sendToApi("rnd_abc123", { type: "ORDER_PLACED", payload: {...} })
             └── PUBLISH "rnd_abc123"

T+6ms    API receives response on channel:
         └── resolve({ orderId, executedQty: 2, fills: [...] })
         └── res.json(response.payload)

T+7ms    Frontend receives HTTP response
         └── Order placed successfully, partial fill (2/5 SOL)

T+10ms   DB Worker (async):
         ├── RPOP "db_processor" → TRADE_ADDED
         │   └── INSERT INTO trades ...
         ├── RPOP "db_processor" → ORDER_UPDATE
         │   └── UPDATE orders SET filled = ...
         └── RPOP "db_balance_updates" → balance changes
             └── INSERT INTO balance_ledger, UPDATE balances

T+3000ms Engine snapshot:
         └── saveSnapshot() → orderbook_snapshots updated
```

#### Redis Keys Touched

```
balances:123:USDC        HSET (lock, then unlock partial)
balances:123:SOL         HSET (receive)
balances:456:USDC        HSET (receive)
balances:456:SOL         HSET (unlock)
messages                 LPUSH, RPOP
db_processor             LPUSH (3x)
db_balance_updates       RPUSH (4x from Lua)
depth@SOL_USDC           PUBLISH
trade@SOL_USDC           PUBLISH
trades_snapshot:SOL_USDC LPUSH
open_orders:user:123     PUBLISH
open_orders:user:456     PUBLISH
rnd_abc123               SUBSCRIBE, PUBLISH
```

#### WebSocket Messages Sent

```json
// To all subscribers of depth@SOL_USDC
{"stream":"depth@SOL_USDC","data":{"e":"depth","asks":[["99","0"]],"bids":[["100","3"]]}}

// To all subscribers of trade@SOL_USDC
{"stream":"trade@SOL_USDC","data":{"e":"trade","t":100,"m":true,"p":"99","q":"2","s":"SOL_USDC","T":1704189186000}}

// To user 123's order channel
{"stream":"open_orders:user:123","data":{"type":"ORDER_PLACED","payload":{"orderId":"ord_xyz789","executedQty":2,"market":"SOL_USDC","price":"100","quantity":"5","side":"buy","status":"partial","userId":"123","timestamp":1704189186005}}}
```

---

## Section 7: Failure and Recovery Scenarios

### WebSocket Disconnects

**Impact**: User loses real-time updates.

**Frontend Handling**:

```typescript
// SignalingManager.ts
this.ws.onclose = () => {
  this.initializedBase = false;
  this.authenticated = false;
  this.authenticatedUserId = null;
  // Messages buffered until reconnect
};

this.ws.onopen = () => {
  this.initializedBase = true;
  this.baseBufferedMessages.forEach((m) => this.ws.send(JSON.stringify(m)));
  this.baseBufferedMessages = [];
  this.authenticate(); // Re-auth
};
```

**Server Handling**:

```typescript
// UserManager.ts
ws.on("close", () => {
  this.users.delete(userId);
  SubscriptionManager.getInstance().userLeft(userId);
});
```

**Recovery**:

1. Client reconnects automatically (browser handles TCP reconnect)
2. Client must re-subscribe to channels
3. Client receives fresh snapshot on subscribe (depth, trades)
4. No message replay - missed updates are lost

### Redis Restarts

**Impact**: Loss of all runtime state.

**Source of Truth**: PostgreSQL

**Recovery Flow**:

```
1. Redis comes back up
2. Engine detects connection (or restarts)
3. Engine.init() queries PostgreSQL:
   - SELECT * FROM orderbook_snapshots
   - SELECT * FROM recent_trades
4. Orderbooks reconstructed from snapshots
5. Balances: API syncs via ENSURE_USER on next order
```

**Data Loss Window**: Up to 3 seconds of orderbook changes (snapshot interval)

**Balance Consistency**:

- DB has authoritative balance from ledger
- API sends ENSURE_USER before critical operations
- Engine tops up Redis if DB > Redis

### Engine Crashes

**Impact**: Order processing stops.

**Recovery**:

```
1. Engine process restarts
2. Engine.init():
   a. Load orderbook_snapshots from DB
   b. Load recent_trades from DB into Redis
   c. Start processing messages queue
3. "messages" queue in Redis preserved
4. Pending orders continue processing
```

**Consistency**:

- In-flight order may be partially processed
- Balance updates are atomic (Lua)
- DB persistence is async - may need reconciliation

### Partial Writes

**Scenario**: Engine crashes mid-order-execution

**Atomicity Boundaries**:

1. Fund locking: Atomic (Lua script)
2. Order matching: In-memory, lost on crash
3. Balance updates: Each update atomic, but sequence may be incomplete
4. DB persistence: Async, may miss

**Recovery Strategy**:

1. On restart, load last snapshot
2. Orders not in snapshot are lost
3. Balances in Redis may be inconsistent
4. API's ENSURE_USER resyncs from DB
5. Users may need to re-place orders

**Recommended Improvements**:

- Write-ahead log for order operations
- Synchronous DB write for critical state
- Saga pattern for multi-step operations

---

## Section 8: Design Decisions and Tradeoffs

### Why Redis Instead of In-Memory Only

| Factor         | In-Memory Only          | Redis                |
| -------------- | ----------------------- | -------------------- |
| Crash recovery | Lost                    | Preserved (with AOF) |
| Multi-process  | Not possible            | Shared state         |
| Pub/Sub        | Custom impl             | Built-in             |
| Operational    | Each deploy loses state | Persistent           |
| Debugging      | Hard to inspect         | redis-cli            |

**Tradeoff**: 0.1-0.5ms latency added per operation.

### Why WebSockets Instead of Polling

| Factor       | Polling                  | WebSocket             |
| ------------ | ------------------------ | --------------------- |
| Latency      | 100ms+ (poll interval)   | <5ms                  |
| Bandwidth    | High (repeated requests) | Low (delta updates)   |
| Server load  | O(users × polls/sec)     | O(events)             |
| Real-time UX | Poor                     | Excellent             |
| Complexity   | Simple                   | Connection management |

**Tradeoff**: Must handle connection lifecycle, reconnection, buffering.

### Why PostgreSQL for History

| Factor            | Redis           | PostgreSQL   |
| ----------------- | --------------- | ------------ |
| Query flexibility | Key-based only  | Full SQL     |
| Storage cost      | RAM (expensive) | Disk (cheap) |
| Durability        | Configurable    | Guaranteed   |
| Compliance/Audit  | Poor            | Excellent    |
| Analytics         | Limited         | Native       |

**Tradeoff**: All writes go through async queue, adding delay for history availability.

### Latency vs Consistency Tradeoffs

**Current Design Choices**:

1. **Async DB writes**: Prioritizes engine latency over durability

   - Pro: Order execution in <5ms
   - Con: 100ms+ delay for DB persistence

2. **Redis balance as source of truth during operation**:

   - Pro: Sub-ms balance checks
   - Con: Requires reconciliation with DB

3. **No distributed transactions**:

   - Pro: Simplicity, speed
   - Con: Possible inconsistency on failures

4. **3-second snapshot interval**:
   - Pro: Minimal performance impact
   - Con: Up to 3s of orderbook data loss

### Scalability Considerations

**Current Bottlenecks**:

1. **Single Engine Process**: All orders go through one Node.js process

   - Mitigation: Vertical scaling, or shard by market

2. **Redis Single Instance**: All state in one Redis

   - Mitigation: Redis Cluster, or separate Redis per market

3. **Orderbook Array Operations**: O(n) matching

   - Mitigation: Sorted data structures (heap, balanced tree)

4. **WS Gateway Single Process**: All connections on one server
   - Mitigation: Horizontal scaling with sticky sessions

**Horizontal Scaling Path**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                            │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  WS Gateway 1   │  │  WS Gateway 2   │  │  WS Gateway 3   │
│  (sticky sess)  │  │  (sticky sess)  │  │  (sticky sess)  │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Redis Cluster  │
                    └────────┬────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Engine (BTC_*)  │  │ Engine (ETH_*)  │  │ Engine (SOL_*)  │
│ Shard 1         │  │ Shard 2         │  │ Shard 3         │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Appendix A: Message Type Reference

### API → Engine (MessageFromApi)

```typescript
type MessageFromApi =
  | { type: "CREATE_ORDER"; data: { market; price; quantity; side; userId } }
  | { type: "CANCEL_ORDER"; data: { orderId; market } }
  | { type: "GET_OPEN_ORDERS"; data: { userId; market } }
  | { type: "GET_DEPTH"; data: { market } }
  | { type: "ON_RAMP"; data: { userId; amount; txnId; asset? } }
  | { type: "ENSURE_USER"; data: { userId; balances } };
```

### Engine → API (MessageToApi)

```typescript
type MessageToApi =
  | { type: "ORDER_PLACED"; payload: { orderId; executedQty; fills } }
  | {
      type: "ORDER_CANCELLED";
      payload: { orderId; executedQty; remainingQty; error? };
    }
  | { type: "OPEN_ORDERS"; payload: Order[] }
  | { type: "DEPTH"; payload: { bids; asks } };
```

### Engine → DB Worker (DbMessage)

```typescript
type DbMessage =
  | {
      type: "TRADE_ADDED";
      data: {
        id;
        isBuyerMaker;
        price;
        quantity;
        market;
        userId;
        orderId;
        timestamp;
      };
    }
  | {
      type: "ORDER_PLACED";
      data: {
        orderId;
        executedQty;
        market;
        price;
        quantity;
        side;
        userId;
        status;
        timestamp;
      };
    }
  | {
      type: "ORDER_UPDATE";
      data: { orderId; executedQty; market?; price?; quantity?; side? };
    }
  | {
      type: "ORDER_CANCELLED";
      data: { orderId; executedQty; market; remainingQty };
    }
  | { type: "SNAPSHOT_SAVED"; data: { market; bids; asks; lastTradeId } };
```

### Engine → WS Gateway (WsMessage)

```typescript
// Depth Update
{ stream: "depth@{market}", data: { e: "depth", bids: [[price, qty]], asks: [[price, qty]] } }

// Trade
{ stream: "trade@{market}", data: { e: "trade", t: tradeId, m: isBuyerMaker, p: price, q: qty, s: market, T: timestamp } }

// Order Update
{ stream: "open_orders:user:{userId}", data: { type: "ORDER_PLACED"|"ORDER_CANCELLED", payload: {...} } }
```

---

## Appendix B: Redis Key Quick Reference

```
# Balances
balances:{userId}:{asset}          Hash {available, locked}

# Snapshots
orderbook_snapshot:{market}        String (JSON)
depth_snapshot:{market}            String (JSON)
trades_snapshot:{market}           List (JSON items, max 100)

# Queues
messages                           List (engine input)
db_processor                       List (db worker input)
db_balance_updates                 List (balance sync)

# Pub/Sub Channels
depth@{market}                     Depth updates
trade@{market}                     Trade notifications
open_orders:user:{userId}          User order updates
{clientId}                         API response channel (ephemeral)
```

---

## Appendix C: Function Call Graph

```
Frontend.makeOrder()
  └── POST /api/v2/order
      └── orderRouter.post("/")
          ├── authMiddleware()
          ├── pool.query() [get balances]
          ├── RedisManager.pushMessage(ENSURE_USER)
          └── RedisManager.sendAndAwait(CREATE_ORDER)
              └── LPUSH "messages"

Engine.main()
  └── while(true) RPOP "messages"
      └── Engine.process()
          └── case CREATE_ORDER:
              └── Engine.createOrder()
                  ├── Engine.checkAndLockFunds()
                  │   └── RedisManager.updateBalance() [Lua]
                  ├── Orderbook.addOrder()
                  │   └── Orderbook.matchBid/Ask()
                  ├── Engine.updateBalance()
                  │   └── RedisManager.updateBalance() [Lua]
                  ├── Engine.createDbTrades()
                  │   └── RedisManager.pushMessage(TRADE_ADDED)
                  ├── Engine.updateDbOrders()
                  │   └── RedisManager.pushMessage(ORDER_UPDATE)
                  ├── Engine.publishWsDepthUpdates()
                  │   └── RedisManager.publishMessage(depth@)
                  ├── Engine.publishWsTrades()
                  │   ├── RedisManager.publishMessage(trade@)
                  │   └── RedisManager.pushToQueue(trades_snapshot)
                  └── Engine.publishWsOrders()
                      └── RedisManager.publishMessage(open_orders:user:)

WS.SubscriptionManager.redisCallbackHandler()
  └── UserManager.getUser().emit()
      └── WebSocket.send()
          └── Frontend.SignalingManager.ws.onmessage()
              └── callbacks[type].forEach(callback())

DB.processTrades()
  └── while(true) RPOP "db_processor"
      └── pgClient.query(INSERT/UPDATE)

DB.processBalances()
  └── while(true) RPOP "db_balance_updates"
      └── pgClient.query(INSERT ledger, UPSERT balances)
```

```

---

**END OF DOCUMENT**
```
