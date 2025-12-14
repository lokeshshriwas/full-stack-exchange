"use client";

import useSWR from "swr";
import { useMemo } from "react";
import MainTableHeader from "./MainTableHeader";
import Table from "./Table";
import { getTickers, marketDataKlines } from "@/app/utils/httpClient";
import TopGainerSection from "./TopGainerSection";

// Fetcher function - combines both API calls
const fetchTableData = async () => {
  const [tickers, klines] = await Promise.all([
    getTickers(),
    marketDataKlines(),
  ]);

  const sortedTickers = tickers.sort(
    (a: any, b: any) => b.lastPrice - a.lastPrice
  );

  return sortedTickers.map((ticker: any) => ({
    ...ticker,
    klines: klines.filter((kline: any) => kline.symbol === ticker.symbol),
  }));
};

const MainTable = () => {
  const {
    data: tableData = [],
    isLoading,
    isValidating,
  } = useSWR("table-data", fetchTableData, {
    revalidateOnFocus: true, // Refresh when window regains focus
    revalidateOnReconnect: true, // Refresh when network reconnects
    refreshInterval: 30000, // Background refresh every 30s
    dedupingInterval: 5000, // Dedupe requests within 5s
    keepPreviousData: true, // Keep showing old data while fetching
  });

  // Memoize processed data
  const memoizedTableData = useMemo(() => tableData, [tableData]);

  if (isLoading && memoizedTableData.length === 0) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4 mt-4">
      <div>
        <TopGainerSection tableData={memoizedTableData} />
      </div>
      <div className="flex flex-col bg-base-background-l2 flex-1 gap-3 rounded-xl p-4">
        <MainTableHeader />
        <Table tableData={memoizedTableData} />
      </div>
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className="flex flex-col gap-4 mt-4 animate-pulse">
    <div className="flex flex justify-between gap-4">
      <div className="h-60 bg-gray-200 w-1/3 rounded-xl" />
      <div className="h-60 bg-gray-200 w-1/3 rounded-xl" />
      <div className="h-60 bg-gray-200 w-1/3 rounded-xl" />
    </div>
    <div className="h-96 bg-gray-200 rounded-xl" />
  </div>
);

export default MainTable;
