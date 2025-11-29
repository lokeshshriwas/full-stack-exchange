import { useEffect, useRef, useState } from "react";
import { ChartManager } from "../utils/ChartManager";
import { getKlines } from "../utils/httpClient";
import { KLine } from "../utils/types";
import { SignalingManager } from "../utils/SignalingManager";

export function TradeView({ market }: { market: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartManagerRef = useRef<ChartManager>(null);
  const fetching = useRef(false);
  const [chartInterval, setChartInterval] = useState("1h");

  // Store klineData in a ref so the callback always has the latest data
  const klineDataRef = useRef<KLine[]>([]);

  const intervalToSeconds = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
  };
  const CANDLE_COUNT = 151;

  // Helper function to parse date strings as UTC consistently
  // CRITICAL: The API returns dates like "2025-11-28 04:15:00" without timezone info
  // These MUST be parsed as UTC, not local time, to avoid timezone offset issues
  const parseAsUTC = (dateStr: string | number): number => {
    if (typeof dateStr === "number") {
      return dateStr;
    }
    // Convert "YYYY-MM-DD HH:MM:SS" to ISO format with Z (UTC)
    const utcDateString = dateStr.replace(" ", "T") + "Z";
    return new Date(utcDateString).getTime();
  };

  useEffect(() => {
    const init = async () => {
      let klineData: KLine[] = [];
      try {
        const now = Math.floor(new Date().getTime() / 1000);
        const intervalSeconds =
          intervalToSeconds[chartInterval as keyof typeof intervalToSeconds];

        const alignedNow = Math.floor(now / intervalSeconds) * intervalSeconds;
        const startTime = alignedNow - intervalSeconds * (CANDLE_COUNT + 1);

        klineData = await getKlines(
          market,
          chartInterval,
          startTime,
          alignedNow
        );
      } catch (e) {
        console.error("Initial fetch error:", e);
      }

      if (chartRef.current) {
        if (chartManagerRef.current) {
          chartManagerRef.current.destroy();
        }

        if (!klineData || klineData.length === 0) {
          return;
        }

        // Initialize the ref with the fetched data
        klineDataRef.current = klineData;

        const chartManager = new ChartManager(
          chartRef.current,
          [
            ...klineData?.map((x) => ({
              close: parseFloat(x.close),
              high: parseFloat(x.high),
              low: parseFloat(x.low),
              open: parseFloat(x.open),
              timestamp: new Date(parseAsUTC(x.end)),
              trades: x.trades,
              volume: x.volume,
              quoteVolume: x.quoteVolume,
            })),
          ].sort((x, y) => (x.timestamp < y.timestamp ? -1 : 1)) || [],
          {
            background: "#0e0f14",
            color: "white",
          },
          async () => {
            if (fetching.current) return;
            fetching.current = true;
            try {
              // Use the ref to get the latest klineData
              const currentKlineData = klineDataRef.current;

              if (currentKlineData.length > 0) {
                const intervalSeconds =
                  intervalToSeconds[
                    chartInterval as keyof typeof intervalToSeconds
                  ];

                // Get the earliest candle we have
                const earliestCandle = currentKlineData[0];

                const earliestStartTime = Math.floor(
                  parseAsUTC(earliestCandle.start) / 1000
                );

                const endTime = earliestStartTime;
                const startTime =
                  endTime - intervalSeconds * (CANDLE_COUNT * 3);

                const newData = await getKlines(
                  market,
                  chartInterval,
                  startTime,
                  endTime
                );

                if (newData.length > 0) {
                  // The last received candle should connect to our first existing candle
                  // Filter to keep only candles that don't overlap with existing data
                  const existingEarliestStartTime = parseAsUTC(
                    earliestCandle.start
                  );

                  // Keep candles whose END time is at or before the existing earliest START time
                  const uniqueNewData = newData.filter((d) => {
                    const candleEndTime = parseAsUTC(d.end);
                    return candleEndTime <= existingEarliestStartTime;
                  });

                  if (uniqueNewData.length > 0) {
                    // Check for gaps before merging
                    const lastNewCandle =
                      uniqueNewData[uniqueNewData.length - 1];
                    const lastNewCandleEnd = parseAsUTC(lastNewCandle.end);
                    const firstExistingCandleStart = parseAsUTC(
                      earliestCandle.start
                    );
                    const gapMs = firstExistingCandleStart - lastNewCandleEnd;
                    const gapCandles = Math.round(
                      gapMs / (intervalSeconds * 1000)
                    );

                    // Merge and sort
                    const mergedData = [
                      ...uniqueNewData,
                      ...currentKlineData,
                    ].sort(
                      (a, b) =>
                        new Date(a.start).getTime() -
                        new Date(b.start).getTime()
                    );

                    // Update the ref with merged data
                    klineDataRef.current = mergedData;

                    // Format for chart
                    const formattedData = mergedData
                      .map((x) => ({
                        close: parseFloat(x.close),
                        high: parseFloat(x.high),
                        low: parseFloat(x.low),
                        open: parseFloat(x.open),
                        timestamp: new Date(parseAsUTC(x.end)),
                        trades: x.trades,
                        volume: x.volume,
                        quoteVolume: x.quoteVolume,
                      }))
                      .sort((x, y) => (x.timestamp < y.timestamp ? -1 : 1));

                    // Remove duplicates based on timestamp
                    const uniqueFormattedData = formattedData.filter(
                      (item, index, self) =>
                        index ===
                        self.findIndex(
                          (t) =>
                            t.timestamp.getTime() === item.timestamp.getTime()
                        )
                    );

                    if (chartManagerRef.current) {
                      chartManagerRef.current.updateData(uniqueFormattedData);
                    }
                  } else {
                    console.log("No new unique data fetched");
                  }
                } else {
                  console.log("No data returned from API");
                }
              }
            } catch (e) {
              console.error("Error fetching more data:", e);
            } finally {
              fetching.current = false;
            }
          }
        );
        chartManagerRef.current = chartManager;
      }

      SignalingManager.getInstance().registerCallback(
        "kline",
        (kline: KLine) => {
          const currentKlineData = klineDataRef.current;
          const newCandleInitiated =
            currentKlineData.length === 0 ||
            currentKlineData[currentKlineData.length - 1].start !== kline.start;

          if (!newCandleInitiated && currentKlineData.length > 0) {
            // Update the last candle
            currentKlineData[currentKlineData.length - 1] = {
              ...currentKlineData[currentKlineData.length - 1],
              close: String(parseFloat(kline.close).toFixed(2)),
              high: String(parseFloat(kline.high).toFixed(2)),
              low: String(parseFloat(kline.low).toFixed(2)),
              open: String(parseFloat(kline.open).toFixed(2)),
              end: kline.end,
              start: kline.start,
              trades: kline.trades,
              volume: kline.volume,
              quoteVolume: kline.quoteVolume,
            };
          } else {
            // Add new candle
            currentKlineData.push(kline);
          }

          // Update the ref
          klineDataRef.current = currentKlineData;

          if (chartManagerRef.current) {
            chartManagerRef.current.update({
              close: parseFloat(kline.close),
              high: parseFloat(kline.high),
              low: parseFloat(kline.low),
              open: parseFloat(kline.open),
              time: parseAsUTC(kline.end),
              newCandleInitiated,
            });
          }
        },
        `kline-${market}`
      );

      SignalingManager.getInstance().sendMessage({
        method: "SUBSCRIBE",
        params: [`kline.${chartInterval}.${market}`],
      });
    };

    init();

    return () => {
      SignalingManager.getInstance().deRegisterCallback(
        "kline",
        `kline-${market}`
      );
      SignalingManager.getInstance().sendMessage({
        method: "UNSUBSCRIBE",
        params: [`kline.${chartInterval}.${market}`],
      });
      if (chartManagerRef.current) {
        chartManagerRef.current.destroy();
        chartManagerRef.current = null;
      }
      // Clear the klineData when component unmounts or interval changes
      klineDataRef.current = [];
    };
  }, [market, chartInterval]);

  return (
    <>
      <div className="flex gap-2 mb-2 bg-black p-2 rounded">
        {["1m", "5m", "15m", "1h", "4h", "1d"].map((int) => (
          <button
            key={int}
            onClick={() => setChartInterval(int)}
            className={`px-2 py-1 text-sm rounded ${
              chartInterval === int
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {int}
          </button>
        ))}
      </div>
      <div
        ref={chartRef}
        style={{ height: "520px", width: "100%", marginTop: 4 }}
      ></div>
    </>
  );
}
