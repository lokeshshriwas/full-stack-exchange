import axios from "axios";

export const BASE_URL = "http://localhost:8080";

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
