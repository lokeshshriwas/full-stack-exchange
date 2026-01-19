"use client";
import { MarketBar } from "@/app/components/MarketBar";
import { SwapUI } from "@/app/components/SwapUI";
import { TradeView } from "@/app/components/TradeView";
import { Depth } from "@/app/components/depth/Depth";
import { SignalingManager } from "@/app/utils/SignalingManager";
import { Orders } from "@/app/components/Orders";
import { getTicker } from "@/app/utils/httpClient";
import { Ticker } from "@/app/utils/types";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function Page() {
  const { market } = useParams();
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [orders, setOrders] = useState<any>(null);

  useEffect(() => {
    getTicker(market as string).then(setTicker);
    SignalingManager.getInstance().registerCallback(
      "ticker",
      (data: Partial<Ticker>) =>
        setTicker((prevTicker) => ({
          firstPrice: data?.firstPrice ?? prevTicker?.firstPrice ?? "",
          high: data?.high ?? prevTicker?.high ?? "",
          lastPrice: data?.lastPrice ?? prevTicker?.lastPrice ?? "",
          low: data?.low ?? prevTicker?.low ?? "",
          priceChange: data?.priceChange ?? prevTicker?.priceChange ?? "",
          priceChangePercent:
            data?.priceChangePercent ?? prevTicker?.priceChangePercent ?? "",
          quoteVolume: data?.quoteVolume ?? prevTicker?.quoteVolume ?? "",
          symbol: data?.symbol ?? prevTicker?.symbol ?? "",
          trades: data?.trades ?? prevTicker?.trades ?? "",
          volume: data?.volume ?? prevTicker?.volume ?? "",
        })),
      `ticker-${market}`,
    );
    SignalingManager.getInstance().sendMessage({
      method: "SUBSCRIBE",
      params: [`ticker.${market}`],
    });

    return () => {
      SignalingManager.getInstance().deRegisterCallback(
        "ticker",
        `ticker-${market}`,
      );
      SignalingManager.getInstance().sendMessage({
        method: "UNSUBSCRIBE",
        params: [`ticker.${market}`],
      });
    };
  }, [market]);

  return (
    <div className="flex flex-col lg:flex-row flex-1 overflow-x-hidden">
      <div className="flex flex-col flex-1 min-w-0">
        <MarketBar market={market as string} ticker={ticker} />
        <div className="flex flex-col lg:flex-row h-auto lg:h-[620px] border-y border-slate-800">
          <div className="flex flex-col flex-1 h-[350px] sm:h-[450px] lg:h-full min-w-0">
            <TradeView market={market as string} />
          </div>
          <div className="w-full lg:w-px flex-col border-slate-800 border-t lg:border-t-0 lg:border-l"></div>
          <div className="flex flex-col w-full lg:w-[250px] h-[400px] lg:h-full overflow-hidden">
            <Depth market={market as string} />
          </div>
        </div>
        <div className="w-full mt-4 overflow-x-auto">
          <Orders market={market as string} />
        </div>
      </div>
      <div className="w-full lg:w-px flex-col border-slate-800 border-t lg:border-t-0 lg:border-l"></div>
      <div className="w-full lg:w-auto">
        <div className="flex flex-col w-full lg:w-[250px]">
          <SwapUI market={market as string} ticker={ticker} />
        </div>
      </div>
    </div>
  );
}
