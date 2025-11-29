import { formatNumber, getFullName, trimString } from "@/app/utils/helper";
import React from "react";
import LineChart from "./LineChart";

const Table = ({ tableData }: { tableData: any }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr>
            <th className="border-b border-base-border-light px-1 py-3 text-xs font-normal text-med-emphasis first:pl-2 last:pr-6">
              <div className="flex flex-row items-center px-1 first:pl-0 cursor-pointer select-none justify-start text-left">
                Name
              </div>
            </th>
            <th className="border-b border-base-border-light w-[17%] px-1 py-3 text-xs font-normal text-med-emphasis first:pl-2 last:pr-6">
              <div className="flex flex-row items-center px-1 first:pl-0 cursor-pointer select-none justify-end text-right">
                Price
              </div>
            </th>
            <th className="border-b border-base-border-light w-[17%] px-1 py-3 text-xs font-normal text-med-emphasis first:pl-2 last:pr-6">
              <div className="flex flex-row items-center px-1 first:pl-0 cursor-pointer select-none justify-end text-right">
                24h Volume
              </div>
            </th>
            {/* <th className="border-b border-base-border-light w-[17%] px-1 py-3 text-xs font-normal text-med-emphasis first:pl-2 last:pr-6">
              <div className="flex flex-row items-center px-1 first:pl-0 cursor-pointer select-none justify-end text-right">
                Market Cap
              </div>
            </th> */}
            <th className="border-b border-base-border-light w-[17%] px-1 py-3 text-xs font-normal text-med-emphasis first:pl-2 last:pr-6">
              <div className="flex flex-row items-center px-1 first:pl-0 cursor-pointer select-none justify-end text-right">
                24h Change
              </div>
            </th>
            <th className="border-b border-base-border-light w-[17%] px-1 py-3 text-xs font-normal text-med-emphasis first:pl-2 last:pr-6">
              <div className="flex flex-row items-center px-1 first:pl-0 cursor-pointer select-none justify-end text-right">
                Last 7 Days
              </div>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-base-border-light">
          {tableData
            ?.filter((item: any) => !item.symbol.endsWith("PERP"))
            .map((item: any) => (
              <tr className="group hover:bg-base-background-l2 cursor-pointer"  key={item?.symbol}>
                <td className="text-sm tabular-nums px-2 py-3 last:pr-7">
                  <a
                    className="flex shrink whitespace-nowrap"
                    href={`/trade/${item?.symbol}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative flex-none overflow-hidden rounded-full border-base-border-med border h-8 w-8">
                        <img
                          alt="BTC Logo"
                          loading="lazy"
                          width="32"
                          height="32"
                          decoding="async"
                          className="text-transparent"
                          src={`https://backpack.exchange/_next/image?url=%2Fcoins%2F${
                            trimString(item?.symbol)
                          }.png&w=64&q=95`}
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-high-emphasis font-medium whitespace-nowrap text-sm">
                          {getFullName(item?.symbol)}
                        </span>
                        <div className="font-medium text-med-emphasis text-xs leading-5">
                          {trimString(item?.symbol)}/USD
                        </div>
                      </div>
                    </div>
                  </a>
                </td>

                <td className="text-sm tabular-nums px-2 py-3 last:pr-7 text-right">
                  <p className="text-sm font-medium tabular-nums">
                    {item?.lastPrice}
                  </p>
                </td>
                <td className="text-sm tabular-nums px-2 py-3 last:pr-7 text-right">
                  <p className="text-sm font-medium tabular-nums">
                    {formatNumber(item?.volume)}
                  </p>
                </td>
                {/* <td className="text-sm tabular-nums px-2 py-3 last:pr-7 text-right">
                  <p className="text-sm font-medium tabular-nums">$2T</p>
                </td> */}
                <td className="text-sm tabular-nums px-2 py-3 last:pr-7 text-right">
                  <p className={`text-sm font-medium tabular-nums text-red-text ${(item?.priceChangePercent * 100) < 0 ? "text-red-500" : "text-green-500"}`}>
                    {(item?.priceChangePercent * 100).toFixed(2)}%
                  </p>
                </td>
                <td className="text-sm tabular-nums px-2 py-3 last:pr-7 text-right">
                  <div className="flex justify-end">
                      <LineChart data={item?.klines[0].data} />
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
