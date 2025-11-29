"use client";

import { useEffect, useState } from "react";
import MainTableHeader from "./MainTableHeader";
import Table from "./Table";
import { getTickers, marketDataKlines } from "@/app/utils/httpClient";
import TopGainerSection from "./TopGainerSection";

const MainTable = () => {
  const [tableData, setTableData] = useState([]);

  useEffect(() => {
    const tickerData = getTickers().then(
      (data) => data.sort((a: any, b: any) => b.lastPrice - a.lastPrice) as any
    );
    const klineData = marketDataKlines().then((data) => data);

    Promise.all([tickerData, klineData]).then(([tickers, klines]) => {
      const tickersWithKlines = tickers.map((ticker: any) => ({
        ...ticker,
        klines: klines.filter((kline: any) => kline.symbol === ticker.symbol),
      }));
      setTableData(tickersWithKlines);
    });
  }, []);

  return (
    <div className="flex flex-col gap-4 mt-4">
      <div>
        <TopGainerSection tableData={tableData} />
      </div>
      <div className="flex flex-col bg-base-background-l2 flex-1 gap-3 rounded-xl p-4">
        <MainTableHeader />
        <Table tableData={tableData} />
      </div>
    </div>
  );
};

export default MainTable;
