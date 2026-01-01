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
      `ticker-${market}`
    );
    SignalingManager.getInstance().sendMessage({
      method: "SUBSCRIBE",
      params: [`ticker.${market}`],
    });

    return () => {
      SignalingManager.getInstance().deRegisterCallback(
        "ticker",
        `ticker-${market}`
      );
      SignalingManager.getInstance().sendMessage({
        method: "UNSUBSCRIBE",
        params: [`ticker.${market}`],
      });
    };
  }, [market]);

  return (
    <div className="flex flex-row flex-1">
      <div className="flex flex-col flex-1">
        <MarketBar market={market as string} ticker={ticker} />
        <div className="flex flex-row h-[620px] border-y border-slate-800">
          <div className="flex flex-col flex-1">
            <TradeView market={market as string} />
          </div>
          <div className="w-px flex-col border-slate-800 border-l"></div>
          <div className="flex flex-col w-[250px] overflow-hidden">
            <Depth market={market as string} />
          </div>
        </div>
        <div className="w-full mt-4">
          <Orders market={market as string} />
        </div>
      </div>
      <div className="w-px flex-col border-slate-800 border-l"></div>
      <div>
        <div className="flex flex-col w-[250px]">
          <SwapUI market={market as string} ticker={ticker} />
        </div>
      </div>
    </div>
  );
}
