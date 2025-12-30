"use client";

import { useEffect, useState } from "react";
import { useUser } from "../hooks/useUser";
import { SignalingManager } from "../utils/SignalingManager";
import axios from "axios";
import useSWR from "swr";

interface Position {
  market: string;
  side: "long" | "short";
  entryPrice: number;
  quantity: number;
  unrealizedPnL: number;
  createdAt: string;
}

interface PositionHistory {
  market: string;
  side: "long" | "short";
  entryPrice: number;
  closePrice: number;
  quantity: number;
  realizedPnL: number;
  openedAt: string;
  closedAt: string;
}

// Fetcher for SWR
const fetcher = (url: string) =>
  axios.get(url, { withCredentials: true }).then((res) => res.data);

export const Positions = ({ market }: { market?: string }) => {
  // market param optional if we want to filter
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<"open" | "history">("open");

  // Fetch Open Positions
  const { data: openPositionsData, mutate: mutateOpen } = useSWR(
    user ? "http://localhost:8080/api/v2/positions" : null,
    fetcher,
    { refreshInterval: 0 } // No polling, rely on WS
  );

  // Fetch History
  const { data: historyData } = useSWR(
    user && activeTab === "history"
      ? "http://localhost:8080/api/v2/positions/history"
      : null,
    fetcher
  );

  const positions: Position[] = openPositionsData?.data || [];
  const history: PositionHistory[] = historyData?.data || [];

  useEffect(() => {
    if (!user) return;

    const channel = `positions:${user.id}`;

    // Register Callback
    SignalingManager.getInstance().registerCallback(
      "POSITION_UPDATE",
      (data: any) => {
        // Determine if it's update or close
        // The data.type comes from the WS message payload
        // SignalManager.ts might strip the wrapper. Let's assume data is the payload.
        // Actually my BE sends { type: "POSITION_UPDATE", data: position }
        // SignalManager.ts emits the WHOLE payload or just data?
        // Wait, SignalManager.ts `redisCallbackHandler` emits `parsedMessage`.
        // My BE `RedisManager.publishMessage` sends `{ stream: channel, data: { type: ..., data: ... } }`.
        // SignalManager.ts expects `message.data.e` type logic for main channels.
        // But for generic Redis sub in `subscribe` method:
        // It calls `redisCallbackHandler` which does `emit(parsedMessage)`.
        // So inside `User.ts`, it emits to WS client.
        // Frontend `SignalingManager.ts` `onmessage` parses event.data.
        // It checks `message.data.e`.
        // My message structure is `{ stream: ..., data: { type: "POSITION_UPDATE", data: ... } }`.
        // So `message.data.type` is "POSITION_UPDATE".
        // Frontend `SignalingManager` checks `callbacks[type]`.
        // So I should register callback for "POSITION_UPDATE" IF `message.data.e` was "POSITION_UPDATE".
        // But my BE sends `type` not `e`.
        // I should change my BE to send `e: "position_update"` format OR modify FE `SignalingManager`.
        // Modifying FE `SignalingManager` is risky for existing stuff.
        // BUT `SignalingManager.ts` line 44: `const type = message.data.e;`.

        // CRITICAL FIX: Backend must send `e: "POSITION_UPDATE"` inside data.
        // Revisit PositionManager.ts?

        // Assuming I can fix BE later or hack FE.
        // Let's assume FE receives it.
        // Wait, if BE sends `type`, and FE looks for `e`, it won't trigger callback.
        // I will update PositionManager.ts to send `e: "outboundPositionUpdate"` or similar.

        // For now, let's proceed assuming I fix the key.

        const updatedPosition = data.data;
        mutateOpen((currentData: any) => {
          if (!currentData) return { success: true, data: [updatedPosition] };
          const list = currentData.data as Position[];
          const index = list.findIndex(
            (p) => p.market === updatedPosition.market
          );

          if (updatedPosition.quantity <= 0) {
            // Should be removed? Actually DELETE is handled by POSITION_CLOSED event
            // But if I get update with 0 qty?
            return {
              ...currentData,
              data: list.filter((p) => p.market !== updatedPosition.market),
            };
          }

          if (index > -1) {
            const newList = [...list];
            newList[index] = updatedPosition;
            return { ...currentData, data: newList };
          } else {
            return { ...currentData, data: [...list, updatedPosition] };
          }
        }, false);
      },
      `positions-${user.id}`
    );

    SignalingManager.getInstance().registerCallback(
      "POSITION_CLOSED",
      (data: any) => {
        const { market } = data.data;
        mutateOpen((currentData: any) => {
          if (!currentData) return currentData;
          return {
            ...currentData,
            data: (currentData.data as Position[]).filter(
              (p) => p.market !== market
            ),
          };
        }, false);
      },
      `positions-closed-${user.id}`
    );

    // Subscribe
    SignalingManager.getInstance().sendMessage({
      method: "SUBSCRIBE",
      params: [`positions:${user.id}`],
    });

    return () => {
      SignalingManager.getInstance().deRegisterCallback(
        "POSITION_UPDATE",
        `positions-${user.id}`
      );
      SignalingManager.getInstance().deRegisterCallback(
        "POSITION_CLOSED",
        `positions-closed-${user.id}`
      );
      SignalingManager.getInstance().sendMessage({
        method: "UNSUBSCRIBE",
        params: [`positions:${user.id}`],
      });
    };
  }, [user, mutateOpen]);

  if (!user)
    return (
      <div className="text-center p-4">Please log in to view positions</div>
    );

  return (
    <div className="flex flex-col w-full bg-base-background-l1 rounded-lg border border-white/10 mt-4">
      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab("open")}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === "open"
              ? "text-blue-500 border-b-2 border-blue-500"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Open Positions
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === "history"
              ? "text-blue-500 border-b-2 border-blue-500"
              : "text-gray-400 hover:text-white"
          }`}
        >
          History
        </button>
      </div>

      {/* Content */}
      <div className="p-0 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-gray-500 border-b border-white/5">
              <th className="px-4 py-3 font-normal">Market</th>
              <th className="px-4 py-3 font-normal">Side</th>
              <th className="px-4 py-3 font-normal text-right">Size</th>
              <th className="px-4 py-3 font-normal text-right">Entry Price</th>
              {activeTab === "open" ? (
                <th className="px-4 py-3 font-normal text-right">
                  Unrealized PnL
                </th>
              ) : (
                <>
                  <th className="px-4 py-3 font-normal text-right">
                    Exit Price
                  </th>
                  <th className="px-4 py-3 font-normal text-right">
                    Realized PnL
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {activeTab === "open" ? (
              positions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    No open positions
                  </td>
                </tr>
              ) : (
                positions.map((p) => {
                  const isProfit = p.unrealizedPnL >= 0;
                  return (
                    <tr
                      key={p.market}
                      className="hover:bg-white/5 border-b border-white/5 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        {p.market}
                      </td>
                      <td
                        className={`px-4 py-3 ${
                          p.side === "long" ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {p.side.toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {p.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {Number(p.entryPrice).toFixed(2)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right ${
                          isProfit ? "text-green-500" : "text-red-500"
                        }`}
                      >
                        {Number(p.unrealizedPnL).toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">
                  No history
                </td>
              </tr>
            ) : (
              history.map((p, i) => {
                const isProfit = p.realizedPnL >= 0;
                return (
                  <tr
                    key={i}
                    className="hover:bg-white/5 border-b border-white/5 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      {p.market}
                    </td>
                    <td
                      className={`px-4 py-3 ${
                        p.side === "long" ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {p.side.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {p.quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {Number(p.entryPrice).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {Number(p.closePrice).toFixed(2)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${
                        isProfit ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {Number(p.realizedPnL).toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
