import axios from "axios";

const BASE_URL = "http://localhost:8080";

export const makeOrder = async (market: string, price: number, quantity: number, side: "buy" | "sell", userId: string) => await axios.post(`${BASE_URL}/api/v2/order`, {
    market,
    price: price.toString(),
    quantity: quantity.toString(),
    side,
    userId,
});

export const cancelOrder = async (orderId: string, market: string, userId: string) => await axios.delete(`${BASE_URL}/api/v2/order`, {
    data: {
        orderId,
        market,
    },
});
