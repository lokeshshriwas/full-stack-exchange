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
    type: "ORDER_CANCELLED",
    data: {
        orderId: string,
        executedQty: number,
        market: string,
        remainingQty: number
    }
}
