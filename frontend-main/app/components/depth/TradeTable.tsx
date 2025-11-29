import { Tradetype } from "@/app/utils/types";
import { timeStamp } from "console";
import React from "react";

type TradeTableHeaderProps = {
  market: string;
};

export const TradeTableHeader: React.FC<TradeTableHeaderProps> = ({
  market,
}) => {
  return (
    <div className="flex justify-between flex-row w-2/3 text-sm mb-2">
      <div className="text-white">{"Price (USD)"}</div>
      <div className="text-slate-500">{`Qty (${market.split("_")[0]})`}</div>
    </div>
  );
};

type TradeTableProps = {
  market: string;
  trades: [];
};

export const TradeTable: React.FC<TradeTableProps> = ({
  market,
  trades,
}: {
  market: string;
  trades: Tradetype[];
}) => {
  return (
    <div className="">
      <TradeTableHeader market={market} />
      <div className="flex flex-col overflow-y-auto h-[500px] border border-gray-700 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {trades.map((trade) => (
          <TradeTableRow
            key={trade.id}
            price={trade.price}
            quantity={trade.quantity}
            timestamp={trade.timestamp}
            isBuyerMaker={trade.isBuyerMaker}
          />
        ))}
      </div>
    </div>
  );
};

export const TradeTableRow = ({
  price,
  quantity,
  timestamp,
  isBuyerMaker,
}: {
  price: string;
  quantity: string;
  timestamp: number;
  isBuyerMaker: boolean;
}) => {
  return (
    <div className={`flex justify-between text-xs w-full mb-1`}>
      <div
        className={` w-full text-sm font-normal capitalize tabular-nums ${
          isBuyerMaker ? "text-red-500" : "text-green-500"
        } text-left`}
      >
        {price}
      </div>
      <div className="flex items-center flex-row w-[33.3%] py-1">
        {quantity}
      </div>
      <div className="w-full text-sm font-normal capitalize tabular-nums text-med-emphasis text-right">
        {
          new Date(timestamp)
            .toLocaleTimeString("en-GB", {
              hour12: false
            })
            .split(" ")[0]
        }
      </div>
    </div>
  );
};
