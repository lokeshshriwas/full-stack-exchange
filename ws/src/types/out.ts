

export type TickerUpdateMessage = {
    type: "ticker",
    data: {
        c?: string,
        h?: string,
        l?: string,
        v?: string,
        V?: string,
        s?: string,
        id: number,
        e: "ticker"
    }
}

export type DepthUpdateMessage = {
    type: "depth",
    data: {
        b?: [string, string][],
        a?: [string, string][],
        id: number,
        e: "depth"
    }
}

export type OrderPlacedMessage = {
    stream: string,
    data: {
        type: "ORDER_PLACED",
        payload: {
            orderId: string,
            executedQty: number,
            market: string,
            price: string,
            quantity: string,
            side: "buy" | "sell",
            userId: string,
            status: "filled" | "partial" | "open",
            timestamp: number
        }
    }
}

export type OrderCancelledMessage = {
    stream: string,
    data: {
        type: "ORDER_CANCELLED",
        payload: {
            orderId: string,
            market: string,
            price: string,
            quantity: string,
            filled: number,
            side: "buy" | "sell",
            remainingQty: number,
            timestamp: number
        }
    }
}

export type OutgoingMessage = TickerUpdateMessage | DepthUpdateMessage | OrderPlacedMessage | OrderCancelledMessage;