export type DbMessage = {
    type: "TRADE_ADDED",
    data: {
        id: string,
        isBuyerMaker: boolean,
        price: string,
        quantity: string,
        quoteQuantity: string,
        timestamp: number,
        market: string,
        orderId: string
    }
} | {
    type: "ORDER_PLACED",
    data: {
        orderId: string,
        executedQty: number,
        market: string,
        price: string,
        quantity: string,
        side: "buy" | "sell",
        userId: string
    }
} | {
    type: "SNAPSHOT_SAVED",
    data: {
        market: string,
        bids: any[],
        asks: any[],
        lastTradeId: number
    }
} | {
    type: "ORDER_UPDATE",
    data: {
        orderId: string,
        executedQty: number,
        market?: string,
        price?: string,
        quantity?: string,
        side?: "buy" | "sell",
    }
} | {
    type: "POSITION_UPDATED",
    data: {
        userId: string,
        market: string,
        side: "long" | "short",
        entryPrice: number,
        quantity: number,
        unrealizedPnL: number,
        created_at: number
    }
} | {
    type: "POSITION_HISTORY",
    data: {
        userId: string,
        market: string,
        side: "long" | "short",
        entryPrice: number,
        closePrice: number,
        quantity: number,
        realizedPnL: number,
        openedAt: number
    }
} | {
    type: "POSITION_CLOSED",
    data: {
        userId: string,
        market: string
    }
}
