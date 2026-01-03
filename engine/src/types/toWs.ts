//TODO: Can we share the types between the ws layer and the engine?

export type TickerUpdateMessage = {
    stream: string,
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
    stream: string,
    data: {
        bids: [string, string][],  // Changed from 'b' to 'bids'
        asks: [string, string][],  // Changed from 'a' to 'asks'
        e: "depth"
    }
}

export type TradeAddedMessage = {
    stream: string,
    data: {
        e: "trade",
        t: number,
        m: boolean,
        p: string,
        q: string,
        s: string, // symbol
        o: string
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

export type OrderUpdateMessage = {
    stream: string,
    data: {
        type: "ORDER_UPDATE",
        payload: {
            orderId: string,
            filled: number,
            price: string,
            market: string
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

export type OrderFillMessage = {
    stream: string,
    data: {
        type: "ORDER_FILL",
        payload: {
            orderId: string,
            filledQty: number,
            price: string,
            market: string,
            side: "buy" | "sell",
            timestamp: number
        }
    }
}

export type WsMessage = TickerUpdateMessage | DepthUpdateMessage | TradeAddedMessage | OrderPlacedMessage | OrderUpdateMessage | OrderCancelledMessage | OrderFillMessage;

