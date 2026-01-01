"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { OrderTable } from "./OrderTable";
import { SignalingManager } from "../utils/SignalingManager";

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

  useEffect(() => {
    let mounted = true;

    const fetchOrders = async () => {
      try {
        // Fetch open orders
        const openRes = await axios.get(
          `http://localhost:8080/api/v2/order/open?market=${market}`,
          { withCredentials: true }
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
            }))
          );
        }

        // Fetch order history
        const historyRes = await axios.get(
          `http://localhost:8080/api/v2/order/history`,
          { withCredentials: true }
        );

        if (mounted) {
          setOrderHistory(historyRes.data);
        }
      } catch (err) {
        console.error("[Orders] HTTP fetch failed", err);
      }
    };

    // Initial fetch
    fetchOrders();

    // Poll every 3 seconds
    const interval = setInterval(fetchOrders, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [market]);

  useEffect(() => {
    const signalingManager = SignalingManager.getInstance();

    const subscribeToOrders = () => {
      const userId = signalingManager.getAuthenticatedUserId();
      if (!userId) return;

      // ORDER PLACED / UPDATED
      signalingManager.registerCallback(
        "ORDER_PLACED",
        (data: any) => {
          const payload = data.payload;
          if (payload.market !== market) return;

          setOpenOrders((prev) => {
            // Remove filled orders
            if (payload.status === "filled") {
              return prev.filter((o) => o.orderId !== payload.orderId);
            }

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
        `orders-placed-${market}`
      );

      // ORDER CANCELLED
      signalingManager.registerCallback(
        "ORDER_CANCELLED",
        (data: any) => {
          const payload = data.payload;
          if (payload.market !== market) return;

          setOpenOrders((prev) =>
            prev.filter((o) => o.orderId !== payload.orderId)
          );
        },
        `orders-cancelled-${market}`
      );

      // Subscribe
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
        `orders-auth-${market}`
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
        `orders-placed-${market}`
      );
      signalingManager.deRegisterCallback(
        "ORDER_CANCELLED",
        `orders-cancelled-${market}`
      );
      signalingManager.deRegisterCallback(
        "auth_success",
        `orders-auth-${market}`
      );
    };
  }, [market]);

  const handleCancel = async (orderId: string, marketIdx: string) => {
    try {
      const resp = await axios.delete("http://localhost:8080/api/v2/order", {
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
    <div className="w-full bg-zinc-900/50 border-t border-zinc-800">
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("open")}
          className={`px-6 py-3 text-sm font-medium ${
            activeTab === "open"
              ? "text-blue-500 border-b-2 border-blue-500"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Open Orders
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-6 py-3 text-sm font-medium ${
            activeTab === "history"
              ? "text-blue-500 border-b-2 border-blue-500"
              : "text-zinc-400 hover:text-white"
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
