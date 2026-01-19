"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { OrderTable } from "./OrderTable";
import { SignalingManager } from "../utils/SignalingManager";
import { env } from "../config/env";

interface OrdersProps {
  market: string;
}

interface Order {
  orderId: string;
  market: string;
  side: "buy" | "sell";
  price: string;
  quantity: string;
  filled: number;
  status: string;
}

export const Orders = ({ market }: OrdersProps) => {
  const [activeTab, setActiveTab] = useState<"open" | "history">("open");
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch order history - can be called from WS callbacks
  const fetchOrderHistory = useCallback(async () => {
    try {
      const historyRes = await axios.get(`${env.apiV2}/order/history`, {
        withCredentials: true,
      });
      setOrderHistory(historyRes.data);
    } catch (err) {
      console.error("[Orders] History fetch failed", err);
    }
  }, []);

  // Debounced history fetch to handle rapid events and DB write delay
  const debouncedFetchHistory = useCallback(() => {
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
    }
    historyTimeoutRef.current = setTimeout(fetchOrderHistory, 200);
  }, [fetchOrderHistory]);

  // Initial data fetch
  useEffect(() => {
    let mounted = true;

    const fetchOpenOrders = async () => {
      try {
        const openRes = await axios.get(
          `${env.apiV2}/order/open?market=${market}`,
          { withCredentials: true },
        );

        if (mounted) {
          setOpenOrders(
            openRes.data.map((o: any) => ({
              orderId: o.orderId,
              market,
              price: o.price,
              quantity: o.quantity,
              filled: o.executedQty,
              side: o.side,
              status: "open",
            })),
          );
        }
      } catch (err) {
        console.error("[Orders] Open orders fetch failed", err);
      }
    };

    // Initial fetch only - no polling
    fetchOpenOrders();
    fetchOrderHistory();

    return () => {
      mounted = false;
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
      }
    };
  }, [market, fetchOrderHistory]);

  // WebSocket subscriptions for real-time updates
  useEffect(() => {
    const signalingManager = SignalingManager.getInstance();

    const subscribeToOrders = () => {
      const userId = signalingManager.getAuthenticatedUserId();
      if (!userId) return;

      // ORDER_PLACED - new order or taker update
      signalingManager.registerCallback(
        "ORDER_PLACED",
        (data: any) => {
          const payload = data.payload;
          if (payload.market !== market) {
            return;
          }

          // If fully filled, don't add to open - just refetch history
          if (payload.status === "filled") {
            debouncedFetchHistory();
            return;
          }

          setOpenOrders((prev) => {
            const updated: Order = {
              orderId: payload.orderId,
              market: payload.market,
              price: payload.price,
              quantity: payload.quantity,
              filled: payload.executedQty,
              side: payload.side,
              status: payload.status,
            };

            const exists = prev.find((o) => o.orderId === payload.orderId);
            return exists
              ? prev.map((o) => (o.orderId === payload.orderId ? updated : o))
              : [...prev, updated];
          });
        },
        `orders-placed-${market}`,
      );

      // ORDER_FILL - maker's order was filled by another user
      signalingManager.registerCallback(
        "ORDER_FILL",
        (data: any) => {
          const payload = data.payload;

          if (payload.market !== market) {
            return;
          }

          setOpenOrders((prev) => {
            const order = prev.find((o) => o.orderId === payload.orderId);
            if (!order) {
              return prev;
            }

            const newFilled = order.filled + payload.filledQty;

            // Check if fully filled
            if (newFilled >= parseFloat(order.quantity)) {
              debouncedFetchHistory();
              return prev.filter((o) => o.orderId !== payload.orderId);
            }

            // Partial fill - update in place
            return prev.map((o) =>
              o.orderId === payload.orderId
                ? { ...o, filled: newFilled, status: "partial" }
                : o,
            );
          });
        },
        `orders-fill-${market}`,
      );

      // ORDER_CANCELLED
      signalingManager.registerCallback(
        "ORDER_CANCELLED",
        (data: any) => {
          const payload = data.payload;
          if (payload.market !== market) return;

          setOpenOrders((prev) =>
            prev.filter((o) => o.orderId !== payload.orderId),
          );
          debouncedFetchHistory();
        },
        `orders-cancelled-${market}`,
      );

      // Subscribe to user's order channel
      signalingManager.sendMessage({
        method: "SUBSCRIBE",
        params: [`open_orders:user:${userId}`],
      });
    };

    // Authenticate then subscribe
    if (!signalingManager.isAuthenticated()) {
      signalingManager.registerCallback(
        "auth_success",
        subscribeToOrders,
        `orders-auth-${market}`,
      );
      signalingManager.authenticate();
    } else {
      subscribeToOrders();
    }

    return () => {
      const userId = signalingManager.getAuthenticatedUserId();
      if (userId) {
        signalingManager.sendMessage({
          method: "UNSUBSCRIBE",
          params: [`open_orders:user:${userId}`],
        });
      }

      signalingManager.deRegisterCallback(
        "ORDER_PLACED",
        `orders-placed-${market}`,
      );
      signalingManager.deRegisterCallback(
        "ORDER_FILL",
        `orders-fill-${market}`,
      );
      signalingManager.deRegisterCallback(
        "ORDER_CANCELLED",
        `orders-cancelled-${market}`,
      );
      signalingManager.deRegisterCallback(
        "auth_success",
        `orders-auth-${market}`,
      );
    };
  }, [market, debouncedFetchHistory]);

  const handleCancel = async (orderId: string, marketIdx: string) => {
    try {
      const resp = await axios.delete(`${env.apiV2}/order`, {
        data: { orderId, market: marketIdx },
        withCredentials: true,
      });

      if (resp.status === 200) {
        setOpenOrders((prev) => prev.filter((o) => o.orderId !== orderId));
        toast.success("Order cancelled");
      } else {
        toast.error("Failed to cancel order");
      }
    } catch (err) {
      console.error("Cancel order failed", err);
      toast.error("Failed to cancel order");
    }
  };

  return (
    <div className="w-full dark:bg-zinc-900/50 bg-white border-t border-zinc-800">
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("open")}
          className={`px-6 py-3 text-sm font-medium ${
            activeTab === "open"
              ? "text-blue-500 border-b-2 border-blue-500"
              : "dark:text-zinc-400 text-black dark:hover:text-white hover:text-zinc-600"
          }`}
        >
          Open Orders
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-6 py-3 text-sm font-medium ${
            activeTab === "history"
              ? "text-blue-500 border-b-2 border-blue-500"
              : "dark:text-zinc-400 text-black dark:hover:text-white hover:text-zinc-600"
          }`}
        >
          Order History
        </button>
      </div>

      <div className="p-4">
        {activeTab === "open" ? (
          <OrderTable orders={openOrders} onCancel={handleCancel} showAction />
        ) : (
          <OrderTable orders={orderHistory} showStatus />
        )}
      </div>
    </div>
  );
};
