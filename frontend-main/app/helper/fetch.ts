import axios from "axios";
import { env } from "../config/env";

export const BASE_URL = env.apiUrl;

export const makeOrder = async (market: string, price: string, quantity: string, side: "buy" | "sell", userId: string) => await axios.post(`${BASE_URL}/api/v2/order`, {
    market,
    price,
    quantity,
    side,
    userId,
}, {
    withCredentials: true
});

export const cancelOrder = async (orderId: string, market: string, userId: string) => await axios.delete(`${BASE_URL}/api/v2/order`, {
    data: {
        orderId,
        market,
    },
});

export const getBalances = async (userId: string) => await axios.get(`${BASE_URL}/api/v2/balances/${userId}`, {
    withCredentials: true
});
