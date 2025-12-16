"use client";

import useSWR from "swr";
import { useMemo } from "react";
import MainTableHeader from "./MainTableHeader";
import Table from "./Table";
import { getTickers, marketDataKlines } from "@/app/utils/httpClient";
import TopGainerSection from "./TopGainerSection";

// Consistent price-based sorting function
const sortByPrice = (tickers: any[]) => {
  return [...tickers].sort((a: any, b: any) => {
    const priceA = parseFloat(a.lastPrice) || 0;
    const priceB = parseFloat(b.lastPrice) || 0;

    // Primary sort: by price (descending - highest first)
    if (priceB !== priceA) {
      return priceB - priceA;
    }

    // Secondary sort: by symbol (alphabetically) for consistency when prices are equal
    return a.symbol.localeCompare(b.symbol);
  });
};

// Fetcher function - combines both API calls
const fetchTableData = async () => {
  const [tickers, klines] = await Promise.all([
    getTickers(),
    marketDataKlines(),
  ]);

  // Sort by price (highest to lowest)
  const sortedTickers = sortByPrice(tickers);

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
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 30000,
    dedupingInterval: 5000,
    keepPreviousData: true,
  });

  // Memoize and ensure consistent sorting
  const memoizedTableData = useMemo(() => {
    return sortByPrice(tableData);
  }, [tableData]);

  if (isLoading && memoizedTableData.length === 0) {
    return <LoadingSkeleton />;
  }

  const sortedTableSymbols = tableData.map((ticker: any) => ticker.symbol);
  console.log(sortedTableSymbols);
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
    <div className="flex justify-between gap-4">
      <div className="h-60 bg-gray-200 w-1/3 rounded-xl" />
      <div className="h-60 bg-gray-200 w-1/3 rounded-xl" />
      <div className="h-60 bg-gray-200 w-1/3 rounded-xl" />
    </div>
    <div className="h-96 bg-gray-200 rounded-xl" />
  </div>
);

export default MainTable;
