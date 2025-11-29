import { trimString } from "@/app/utils/helper";
import React from "react";

const Row = ({tableData} : {tableData: any}) => {
  return (
    tableData?.map((item: any) => (
    <a className="flex px-4 py-2 hover:bg-white/4" href="/trade/APR_USD">
      <span className="w-[40%]">
        <div className="flex items-center flex-row min-w-max gap-2 w-full">
          <div className="flex flex-row relative shrink-0">
            <img
                alt={`${trimString(item.symbol)} logo`}
                loading="lazy"
                width="20"
                height="20"
                decoding="async"
                data-nimg="1"
                className="z-10 rounded-full "
                src={`https://backpack.exchange/_next/image?url=%2Fcoins%2F${trimString(item.symbol)}.png&w=48&q=75`}
              />
          </div>
          <p className="font-medium text-high-emphasis text-nowrap text-sm">
            {trimString(item.symbol)?.toUpperCase()}
          </p>
        </div>
      </span>
      <span className="w-[30%]">
        <p className="text-high-emphasis font-medium text-right text-sm tabular-nums">
          ${item.lastPrice}
        </p>
      </span>
      <span className="w-[30%]">
        <p className={`font-medium text-right text-sm tabular-nums ${item.priceChangePercent * 100 > 0 ? "text-green-500" : "text-red-500"}`}>
          {(item.priceChangePercent * 100).toFixed(2)}%
        </p>
      </span>
    </a>
    ))
  );
};

const TopGainerCard = ({
  header,
  tableData,
}: {
  header: string;
  tableData: any;
}) => {
  return (
    <div className="bg-base-background-l2 rounded-lg text-base shadow-xs w-full p-4 px-0">
      <div className="flex justify-between flex-row mb-2 items-baseline px-4">
        <p className="text-high-emphasis font-medium">{header}</p>
        <p className="font-medium text-med-emphasis text-sm">24h Change</p>
      </div>
      <Row tableData={tableData} />
    </div>
  );
};

export default TopGainerCard;
