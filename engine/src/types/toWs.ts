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

export type WsMessage = TickerUpdateMessage | DepthUpdateMessage | TradeAddedMessage;