
export const SUBSCRIBE = "SUBSCRIBE";
export const UNSUBSCRIBE = "UNSUBSCRIBE";

export type SubscribeMessage = {
    method: typeof SUBSCRIBE,
    params: string[]
}

export type UnsubscribeMessage = {
    method: typeof UNSUBSCRIBE,
    params: string[]
}

export const AUTH = "AUTH";

export type AuthMessage = {
    method: typeof AUTH,
    params: string[]
}

export type IncomingMessage = SubscribeMessage | UnsubscribeMessage | AuthMessage;