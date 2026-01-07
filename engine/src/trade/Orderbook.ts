import { BASE_CURRENCY } from "./Engine";

export interface Order {
    price: number;
    quantity: number;
    orderId: string;
    filled: number;
    side: "buy" | "sell";
    userId: string;
}

export interface Fill {
    price: string;
    qty: number;
    tradeId: number;
    otherUserId: string;
    markerOrderId: string;
}

export interface Trade {
    price: string;
    quantity: number;
    tradeId: number;
    timestamp: number;
    isBuyerMaker: boolean;
}

export class Orderbook {
    bids: Order[];
    asks: Order[];
    baseAsset: string;
    quoteAsset: string = BASE_CURRENCY;
    lastTradeId: number;
    currentPrice: number;
    trades: Trade[] = [];

    constructor(baseAsset: string, bids: Order[], asks: Order[], lastTradeId: number, currentPrice: number, quoteAsset?: string, trades?: Trade[]) {
        this.bids = bids;
        this.asks = asks;
        this.baseAsset = baseAsset;
        this.quoteAsset = quoteAsset || BASE_CURRENCY;
        this.lastTradeId = lastTradeId || 0;
        this.currentPrice = currentPrice || 0;
        this.trades = trades || [];
    }

    ticker() {
        return `${this.baseAsset}_${this.quoteAsset}`;
    }

    getSnapshot() {
        return {
            baseAsset: this.baseAsset,
            bids: this.bids,
            asks: this.asks,
            lastTradeId: this.lastTradeId,
            currentPrice: this.currentPrice,
            quoteAsset: this.quoteAsset,
            trades: this.trades
        }
    }

    addOrder(order: Order): {
        executedQty: number,
        fills: Fill[]
    } {
        if (order.side === "buy") {
            const { executedQty, fills } = this.matchBid(order);
            order.filled = executedQty;
            if (executedQty === order.quantity) {
                return {
                    executedQty,
                    fills
                }
            }
            this.bids.push(order);
            return {
                executedQty,
                fills
            }
        } else {
            const { executedQty, fills } = this.matchAsk(order);
            order.filled = executedQty;
            if (executedQty === order.quantity) {
                return {
                    executedQty,
                    fills
                }
            }
            this.asks.push(order);
            return {
                executedQty,
                fills
            }
        }
    }

    matchBid(order: Order): { fills: Fill[], executedQty: number } {
        const fills: Fill[] = [];
        let executedQty = 0;

        for (let i = 0; i < this.asks.length; i++) {
            // SELF-TRADE PREVENTION (per ARCHITECTURE.md Section 4.2, lines 714-753)
            // Skip orders from the same user to prevent self-trading
            // The incoming order will rest on the book if no other matching orders exist
            if (this.asks[i].userId === order.userId) {
                continue;
            }

            if (this.asks[i].price <= order.price && executedQty < order.quantity) {
                const remainingAskQty = this.asks[i].quantity - this.asks[i].filled;
                const filledQty = Math.min((order.quantity - executedQty), remainingAskQty);
                executedQty += filledQty;
                this.asks[i].filled += filledQty;

                const fill: Fill = {
                    price: this.asks[i].price.toString(),
                    qty: filledQty,
                    tradeId: this.lastTradeId++,
                    otherUserId: this.asks[i].userId,
                    markerOrderId: this.asks[i].orderId
                };

                fills.push(fill);

                this.trades.push({
                    price: fill.price,
                    quantity: fill.qty,
                    tradeId: fill.tradeId,
                    timestamp: Date.now(),
                    isBuyerMaker: true
                });
                if (this.trades.length > 50) {
                    this.trades.shift();
                }
            }
        }
        for (let i = 0; i < this.asks.length; i++) {
            if (this.asks[i].filled === this.asks[i].quantity) {
                this.asks.splice(i, 1);
                i--;
            }
        }
        return {
            fills,
            executedQty
        };
    }

    matchAsk(order: Order): { fills: Fill[], executedQty: number } {
        const fills: Fill[] = [];
        let executedQty = 0;

        for (let i = 0; i < this.bids.length; i++) {
            // SELF-TRADE PREVENTION (per ARCHITECTURE.md Section 4.2, lines 714-753)
            // Skip orders from the same user to prevent self-trading  
            // The incoming order will rest on the book if no other matching orders exist
            if (this.bids[i].userId === order.userId) {
                continue;
            }

            if (this.bids[i].price >= order.price && executedQty < order.quantity) {
                const remainingBidQty = this.bids[i].quantity - this.bids[i].filled;
                const amountRemaining = Math.min(order.quantity - executedQty, remainingBidQty);
                executedQty += amountRemaining;
                this.bids[i].filled += amountRemaining;

                const fill: Fill = {
                    price: this.bids[i].price.toString(),
                    qty: amountRemaining,
                    tradeId: this.lastTradeId++,
                    otherUserId: this.bids[i].userId,
                    markerOrderId: this.bids[i].orderId
                };

                fills.push(fill);

                // For a Sell Order (Taker), the Bid (Maker) is the buyer.
                // So isBuyerMaker is FALSE because the Taker is the Seller.
                this.trades.push({
                    price: fill.price,
                    quantity: fill.qty,
                    tradeId: fill.tradeId,
                    timestamp: Date.now(),
                    isBuyerMaker: false
                });
                if (this.trades.length > 50) {
                    this.trades.shift();
                }
            }
        }
        for (let i = 0; i < this.bids.length; i++) {
            if (this.bids[i].filled === this.bids[i].quantity) {
                this.bids.splice(i, 1);
                i--;
            }
        }
        return {
            fills,
            executedQty
        };
    }

    //TODO: Can you make this faster? Can you compute this during order matches?
    getDepth() {
        const bids: [string, string][] = [];
        const asks: [string, string][] = [];

        const bidsObj: { [key: string]: number } = {};
        const asksObj: { [key: string]: number } = {};

        for (let i = 0; i < this.bids.length; i++) {
            const order = this.bids[i];
            if (!bidsObj[order.price]) {
                bidsObj[order.price] = 0;
            }
            bidsObj[order.price] += (order.quantity - order.filled);
        }

        for (let i = 0; i < this.asks.length; i++) {
            const order = this.asks[i];
            if (!asksObj[order.price]) {
                asksObj[order.price] = 0;
            }
            asksObj[order.price] += (order.quantity - order.filled);
        }

        for (const price in bidsObj) {
            bids.push([price, bidsObj[price].toString()]);
        }

        for (const price in asksObj) {
            asks.push([price, asksObj[price].toString()]);
        }

        return {
            bids,
            asks
        };
    }

    getOpenOrders(userId: string): Order[] {
        const asks = this.asks.filter(x => x.userId === userId);
        const bids = this.bids.filter(x => x.userId === userId);
        return [...asks, ...bids];
    }

    cancelBid(order: Order) {
        const index = this.bids.findIndex(x => x.orderId === order.orderId);
        if (index !== -1) {
            const price = this.bids[index].price;
            this.bids.splice(index, 1);
            return price
        }
    }

    cancelAsk(order: Order) {
        const index = this.asks.findIndex(x => x.orderId === order.orderId);
        if (index !== -1) {
            const price = this.asks[index].price;
            this.asks.splice(index, 1);
            return price
        }
    }

}
