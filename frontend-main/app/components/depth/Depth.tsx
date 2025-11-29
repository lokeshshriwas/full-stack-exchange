"use client";

import { useEffect, useState } from "react";
import {
  getDepth,
  getKlines,
  getTicker,
  getTrades,
} from "../../utils/httpClient";
import { BidTable } from "./BidTable";
import { AskTable } from "./AskTable";
import { SignalingManager } from "@/app/utils/SignalingManager";
import DepthHeader from "./DepthHeader";
import { TradeTable } from "./TradeTable";
import { Ticker, Tradetype } from "@/app/utils/types";

export function Depth({ market }: { market: string }) {
  const [bids, setBids] = useState<[string, string][]>();
  const [asks, setAsks] = useState<[string, string][]>();
  const [price, setPrice] = useState<string>();
  const [activeDepth, setActiveDepth] = useState<"book" | "trade">("book");
  const [trades, setTrades] = useState<Tradetype[]>([]);

  const ChangeDepth = (depth: string | undefined) => {
    if (depth === "book" || depth === "trade") {
      setActiveDepth(depth || "book");
    }
  };

  useEffect(() => {
    getDepth(market).then((d) => {
      setBids(d.bids.reverse());
      setAsks(d.asks);
    });

    getTrades(market).then((d) => setTrades(d));

    getTicker(market).then((t) => setPrice(t.lastPrice));

    // Subscribe to the depth channel
    SignalingManager.getInstance().registerCallback(
      "depth",
      (data: any) => {
        setBids((originalBids = []) => {
          // Step 1: Copy old bids to mutate safely
          let updatedBids = [...originalBids];

          // Step 2: For each incoming bid [price, qty]
          for (const [price, qty] of data.bids) {
            const quantity = Number(qty);
            const existingIndex = updatedBids.findIndex((b) => b[0] === price);

            if (existingIndex !== -1) {
              // Case 1: Price already exists → update or remove
              if (quantity === 0) {
                updatedBids.splice(existingIndex, 1); // remove it
              } else {
                updatedBids[existingIndex][1] = qty; // update its quantity
              }
            } else {
              // Case 2: Price does NOT exist → add it (if qty > 0)
              if (quantity > 0) {
                updatedBids.push([price, qty]);
              }
            }
          }

          // Step 3 (optional): sort bids descending by price, if you want a proper order book
          updatedBids.sort((a, b) => Number(b[0]) - Number(a[0]));

          return updatedBids;
        });

        setAsks((originalAsks = []) => {
          // Step 1: Copy old bids to mutate safely
          let updatedAsks = [...originalAsks];

          // Step 2: For each incoming bid [price, qty]
          for (const [price, qty] of data.asks) {
            const quantity = Number(qty);
            const existingIndex = updatedAsks.findIndex((b) => b[0] === price);

            if (existingIndex !== -1) {
              // Case 1: Price already exists → update or remove
              if (quantity === 0) {
                updatedAsks.splice(existingIndex, 1); // remove it
              } else {
                updatedAsks[existingIndex][1] = qty; // update its quantity
              }
            } else {
              // Case 2: Price does NOT exist → add it (if qty > 0)
              if (quantity > 0) {
                updatedAsks.push([price, qty]);
              }
            }
          }

          // Step 3 (optional): sort bids asending by price, if you want a proper order book
          updatedAsks.sort((a, b) => Number(a[0]) - Number(b[0]));

          return updatedAsks;
        });
      },
      `DEPTH-${market}`
    );

    // Subscribe to the trade channel
    SignalingManager.getInstance().registerCallback(
      "trade",
      (data: any) => {
        setTrades((originalTrades = []) => {
          // Step 1: Copy old trades to mutate safely
          let updatedTrades = [...originalTrades];

          // Step 2: For each incoming trade
          const existingIndex = updatedTrades.findIndex(
            (t) => t.id === data.id
          );

          if (existingIndex !== -1) {
            // Case 1: Trade already exists → update it
            updatedTrades[existingIndex] = data;
          } else {
            // Case 2: Trade does NOT exist → add it and remove the last one
            updatedTrades.pop();
            updatedTrades = [data, ...updatedTrades];
          }

          return updatedTrades;
        });
      },
      `trade-${market}`
    );

    // Accessing pre-subscribed price data from ticker channel
    SignalingManager.getInstance().registerCallback(
      "ticker",
      (data: Partial<Ticker>) =>
        setPrice((prevPrice) => data?.lastPrice ?? prevPrice ?? ""),
      `ticker-${market}`
    );

    SignalingManager.getInstance().sendMessage({
      method: "SUBSCRIBE",
      params: [`depth.200ms.${market}`],
    });
    SignalingManager.getInstance().sendMessage({
      method: "SUBSCRIBE",
      params: [`trade.${market}`],
    });

    return () => {
      SignalingManager.getInstance().sendMessage({
        method: "UNSUBSCRIBE",
        params: [`depth.200ms.${market}`],
      });
      SignalingManager.getInstance().deRegisterCallback(
        "depth",
        `DEPTH-${market}`
      );
      SignalingManager.getInstance().sendMessage({
        method: "UNSUBSCRIBE",
        params: [`trade.${market}`],
      });
      SignalingManager.getInstance().deRegisterCallback(
        "trade",
        `TRADE-${market}`
      );
    };
  }, [market]);

  return (
    <div className="h-screen">
      <DepthHeader
        onClick={(depth: string) => ChangeDepth(depth)}
        activeDepth={activeDepth}
      />
      {activeDepth == "book" && (
        <div>
          <TableHeader />
          {asks && <AskTable asks={asks} />}
          {price && <div>{price}</div>}
          {bids && <BidTable bids={bids} />}
        </div>
      )}

      {activeDepth == "trade" && <TradeTable market={market} trades={trades} />}
    </div>
  );
}

function TableHeader() {
  return (
    <div className="flex justify-between text-xs">
      <div className="text-white">Price</div>
      <div className="text-slate-500">Size</div>
      <div className="text-slate-500">Total</div>
    </div>
  );
}
