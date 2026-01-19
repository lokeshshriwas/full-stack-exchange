"use client";

import React from "react";

interface Order {
  orderId: string;
  market: string;
  side: "buy" | "sell";
  price: string;
  quantity: string;
  filled: number;
  status?: string;
  timestamp?: number;
}

interface OrderTableProps {
  orders: Order[];
  onCancel?: (orderId: string, market: string) => void;
  showStatus?: boolean; // For history
  showAction?: boolean; // For open orders
}

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  onCancel,
  showStatus,
  showAction,
}) => {
  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full text-left text-sm text-gray-400">
        <thead className="dark:bg-zinc-900 bg-zinc-300 dark:text-white text-zinc-800 text-xs uppercase font-medium">
          <tr>
            <th className="px-2 sm:px-4 py-2 whitespace-nowrap">Market</th>
            <th className="px-2 sm:px-4 py-2 whitespace-nowrap">Side</th>
            <th className="px-2 sm:px-4 py-2 whitespace-nowrap">Price</th>
            <th className="px-2 sm:px-4 py-2 whitespace-nowrap">Quantity</th>
            <th className="px-2 sm:px-4 py-2 whitespace-nowrap">Filled</th>
            {showStatus && (
              <th className="px-2 sm:px-4 py-2 whitespace-nowrap">Status</th>
            )}
            {showAction && (
              <th className="px-2 sm:px-4 py-2 text-right whitespace-nowrap">
                Action
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {orders.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="px-2 sm:px-4 py-8 text-center text-zinc-600"
              >
                No orders found
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr
                key={order.orderId}
                className="dark:hover:bg-zinc-800/50 hover:bg-zinc-200 transition-colors"
              >
                <td className="px-2 sm:px-4 py-2 font-medium dark:text-white text-zinc-800 whitespace-nowrap">
                  {order.market}
                </td>
                <td
                  className={`px-2 sm:px-4 py-2 whitespace-nowrap ${
                    order.side === "buy" ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {order.side.toUpperCase()}
                </td>
                <td className="px-2 sm:px-4 py-2 dark:text-white text-zinc-800 whitespace-nowrap">
                  {order.price}
                </td>
                <td className="px-2 sm:px-4 py-2 dark:text-white text-zinc-800 whitespace-nowrap">
                  {order.quantity}
                </td>
                <td className="px-2 sm:px-4 py-2 dark:text-white text-zinc-800 whitespace-nowrap">
                  {order.filled ? order.filled : 0}
                </td>
                {showStatus && (
                  <td className="px-2 sm:px-4 py-2 capitalize dark:text-white text-zinc-800 font-bold whitespace-nowrap">
                    {order.status || "Open"}
                  </td>
                )}
                {showAction && onCancel && (
                  <td className="px-2 sm:px-4 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => onCancel(order.orderId, order.market)}
                      className="text-red-500 hover:text-red-400 text-xs border border-red-500/50 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                    >
                      Cancel
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
