"use client";

import { useEffect, useState } from "react";
import { getTicker } from "../../utils/httpClient";
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
    getTicker(market).then((t) => setPrice(t.lastPrice));

    // Subscribe to the depth channel
    SignalingManager.getInstance().registerCallback(
      "depth",
      (data: any) => {
        // If this is a snapshot, replace entire state
        if (data.isSnapshot) {
          console.log(
            "[Depth] Received depth snapshot:",
            data.bids?.length,
            "bids,",
            data.asks?.length,
            "asks",
          );
          setBids(data.bids || []);
          setAsks(data.asks || []);
          return;
        }

        // Incremental update - merge with existing state
        setBids((originalBids = []) => {
          let updatedBids = [...originalBids];
          for (const [price, qty] of data.bids) {
            const quantity = Number(qty);
            const existingIndex = updatedBids.findIndex((b) => b[0] === price);

            if (existingIndex !== -1) {
              if (quantity === 0) {
                updatedBids.splice(existingIndex, 1);
              } else {
                updatedBids[existingIndex][1] = qty;
              }
            } else {
              if (quantity > 0) {
                updatedBids.push([price, qty]);
              }
            }
          }
          updatedBids.sort((a, b) => Number(b[0]) - Number(a[0]));

          return updatedBids;
        });

        setAsks((originalAsks = []) => {
          let updatedAsks = [...originalAsks];
          for (const [price, qty] of data.asks) {
            const quantity = Number(qty);
            const existingIndex = updatedAsks.findIndex((b) => b[0] === price);

            if (existingIndex !== -1) {
              if (quantity === 0) {
                updatedAsks.splice(existingIndex, 1);
              } else {
                updatedAsks[existingIndex][1] = qty;
              }
            } else {
              if (quantity > 0) {
                updatedAsks.push([price, qty]);
              }
            }
          }

          updatedAsks.sort((a, b) => Number(a[0]) - Number(b[0]));

          return updatedAsks;
        });
      },
      `depth@${market}`,
    );

    // Subscribe to the trade channel
    SignalingManager.getInstance().registerCallback(
      "trade",
      (data: any) => {
        setTrades((originalTrades = []) => {
          // Handle snapshot - array of trades for initial load
          if (Array.isArray(data)) {
            console.log(
              "[Depth] Received trades snapshot:",
              data.length,
              "trades",
            );
            return data;
          }

          // Single trade update - merge with existing
          let updatedTrades = [...originalTrades];

          const existingIndex = updatedTrades.findIndex(
            (t) => t.id === data.id,
          );

          if (existingIndex !== -1) {
            updatedTrades[existingIndex] = data;
          } else {
            if (updatedTrades.length >= 50) {
              updatedTrades.pop();
              updatedTrades = [data, ...updatedTrades];
            } else {
              updatedTrades = [data, ...updatedTrades];
            }
          }

          return updatedTrades;
        });
      },
      `trade@${market}`,
    );

    // Accessing pre-subscribed price data from ticker channel
    SignalingManager.getInstance().registerCallback(
      "ticker",
      (data: Partial<Ticker>) =>
        setPrice((prevPrice) => data?.lastPrice ?? prevPrice ?? ""),
      `ticker@${market}`,
    );

    SignalingManager.getInstance().sendMessage({
      method: "SUBSCRIBE",
      params: [`depth@${market}`],
    });
    SignalingManager.getInstance().sendMessage({
      method: "SUBSCRIBE",
      params: [`trade@${market}`],
    });

    return () => {
      SignalingManager.getInstance().sendMessage({
        method: "UNSUBSCRIBE",
        params: [`depth@${market}`],
      });
      SignalingManager.getInstance().deRegisterCallback(
        "depth",
        `depth@${market}`,
      );
      SignalingManager.getInstance().sendMessage({
        method: "UNSUBSCRIBE",
        params: [`trade@${market}`],
      });
      SignalingManager.getInstance().deRegisterCallback(
        "trade",
        `trade@${market}`,
      );
    };
  }, [market]);

  return (
    <div className="h-full overflow-y-auto">
      <DepthHeader
        onClick={(depth: string) => ChangeDepth(depth)}
        activeDepth={activeDepth}
      />
      {activeDepth == "book" && (
        <div>
          <TableHeader />
          {asks && <AskTable asks={asks} />}
          {price && <div className="mx-2">{price}</div>}
          {bids && <BidTable bids={bids} />}
        </div>
      )}

      {activeDepth == "trade" && <TradeTable market={market} trades={trades} />}
    </div>
  );
}

function TableHeader() {
  return (
    <div className="flex justify-between text-xs m-2">
      <div className="dark:text-white text-slate-600">Price</div>
      <div className="text-slate-500">Size</div>
      <div className="text-slate-500">Total</div>
    </div>
  );
}
