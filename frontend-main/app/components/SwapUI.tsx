"use client";
import { useState } from "react";
import { Ticker } from "../utils/types";
import { makeOrder } from "../helper/fetch";
import { trimString } from "../utils/helper";
import { useUser } from "../hooks/useUser";
import { useRouter } from "next/navigation";
import { useBalance } from "../hooks/useBalance";
import toast from "react-hot-toast";

export function SwapUI({
  market,
  ticker,
}: {
  market: string;
  ticker: Ticker | null;
}) {
  const [amount, setAmount] = useState<string>(
    ticker?.lastPrice?.toString() ?? "1"
  );
  const [qty, setQty] = useState<string>("1");
  const [activeTab, setActiveTab] = useState("buy");
  const [type, setType] = useState("market");
  const router = useRouter();
  const { user, loading } = useUser();
  const {
    getFormattedBalance,
    getBalanceForAsset, // Add this for validation
    baseAsset,
    quoteAsset,
    loading: balanceLoading,
  } = useBalance(user, market);

  const numAmount = Number(amount);
  const numQty = Number(qty);

  return (
    <div>
      <div className="flex flex-col">
        <div className="flex flex-row h-[60px]">
          <BuyButton activeTab={activeTab} setActiveTab={setActiveTab} />
          <SellButton activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
        <div className="flex flex-col gap-1">
          <div className="px-3">
            <div className="flex flex-row flex-0 gap-5 undefined">
              <LimitButton type={type} setType={setType} />
              <MarketButton type={type} setType={setType} />
            </div>
          </div>

          <div className="flex flex-col px-3">
            <div className="flex flex-col flex-1 gap-3 text-base-text-high-emphasis">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between flex-row">
                  <p className="text-xs font-normal text-base-text-med-emphasis">
                    Available Balance
                  </p>
                  <div className="flex flex-col items-end gap-1">
                    <p className="font-medium text-xs text-base-text-high-emphasis">
                      {balanceLoading
                        ? "Loading..."
                        : `${getFormattedBalance(quoteAsset)} ${quoteAsset}`}
                    </p>
                    {activeTab === "sell" && (
                      <p className="font-medium text-xs text-base-text-med-emphasis">
                        {balanceLoading
                          ? "..."
                          : `${getFormattedBalance(baseAsset)} ${baseAsset}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {type === "limit" ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-normal text-base-text-med-emphasis">
                    Price
                  </p>
                  <div className="flex flex-col relative">
                    <input
                      onChange={(e) => setAmount(e.target.value)}
                      value={amount}
                      step="0.01"
                      type="number"
                      placeholder=""
                      className="h-12 rounded-lg border-2 border-solid border-base-border-light bg-[var(--background)] pr-12 text-right text-2xl leading-9 placeholder-base-text-med-emphasis ring-0 transition focus:border-accent-blue appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <div className="flex flex-row absolute right-1 top-1 p-2">
                      <div className="relative">
                        <img src="/usdc.webp" className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3"></div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-normal text-base-text-med-emphasis">
                Quantity
              </p>
              <div className="flex flex-col relative">
                <input
                  onChange={(e) => setQty(e.target.value)}
                  value={qty}
                  step="0.01"
                  type="number"
                  className="h-12 rounded-lg border-2 border-solid border-base-border-light bg-[var(--background)] pr-12 text-right text-2xl leading-9 placeholder-base-text-med-emphasis ring-0 transition focus:border-accent-blue appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="flex flex-row absolute right-1 top-1 p-2">
                  <div className="relative">
                    <img
                      src={`https://backpack.exchange/_next/image?url=%2Fcoins%2F${trimString(
                        market
                      )}.png&w=64&q=95`}
                      className="w-6 h-6"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end flex-row">
                <p className="font-medium pr-2 text-xs text-base-text-med-emphasis">
                  {type === "limit"
                    ? `${(numQty * numAmount).toFixed(2)}$`
                    : `${(numQty * Number(ticker?.lastPrice)).toFixed(2)}$`}
                </p>
              </div>

              <div className="flex justify-center flex-row mt-2 gap-3">
                <div className="flex items-center justify-center flex-row rounded-full py-1.5 px-2 text-xs cursor-pointer bg-base-background-l2 hover:bg-base-background-l3">
                  25%
                </div>
                <div className="flex items-center justify-center flex-row rounded-full py-1.5 px-2 text-xs cursor-pointer bg-base-background-l2 hover:bg-base-background-l3">
                  50%
                </div>
                <div className="flex items-center justify-center flex-row rounded-full py-1.5 px-2 text-xs cursor-pointer bg-base-background-l2 hover:bg-base-background-l3">
                  75%
                </div>
                <div className="flex items-center justify-center flex-row rounded-full py-1.5 px-2 text-xs cursor-pointer bg-base-background-l2 hover:bg-base-background-l3">
                  Max
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {loading ? (
                <div className="font-semibold text-center h-12 rounded-xl text-base px-4 py-2 my-4 bg-slate-800 text-slate-400 cursor-wait">
                  Loading...
                </div>
              ) : user ? (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();

                    const price =
                      type === "limit" ? numAmount : Number(ticker?.lastPrice);

                    const action = activeTab === "buy" ? "buy" : "sell";

                    // CLIENT-SIDE BALANCE VALIDATION
                    if (action === "buy") {
                      // For buy orders, check USDC balance
                      const requiredAmount = numQty * price;
                      const usdcBalance = getBalanceForAsset(quoteAsset);
                      const availableUsdc = usdcBalance
                        ? parseFloat(usdcBalance.available)
                        : 0;

                      if (availableUsdc < requiredAmount) {
                        toast.error(
                          `Insufficient ${quoteAsset} balance. Required: ${requiredAmount.toFixed(
                            2
                          )}, Available: ${availableUsdc.toFixed(2)}`
                        );
                        return;
                      }
                    } else {
                      // For sell orders, check base asset balance
                      const baseBalance = getBalanceForAsset(baseAsset);
                      const availableBase = baseBalance
                        ? parseFloat(baseBalance.available)
                        : 0;

                      if (availableBase < numQty) {
                        toast.error(
                          `Insufficient ${baseAsset} balance. Required: ${numQty.toFixed(
                            4
                          )}, Available: ${availableBase.toFixed(4)}`
                        );
                        return;
                      }
                    }

                    // Proceed with order if validation passes
                    try {
                      const { data } = await makeOrder(
                        market,
                        price.toString(),
                        numQty.toString(),
                        action,
                        user.id
                      );

                      if (data.error) {
                        toast.error(data.error || "Order failed");
                      } else {
                        toast.success(
                          `${
                            action === "buy" ? "Buy" : "Sell"
                          } order placed successfully`
                        );
                      }
                    } catch (error: any) {
                      console.error("Order placement error:", error);
                      toast.error(
                        error.response?.data?.message || "Failed to place order"
                      );
                    }
                  }}
                  className={`font-semibold focus:ring-blue-200 text-center h-12 rounded-xl text-base px-4 py-2 my-4 ${
                    activeTab === "buy" ? "bg-green-500" : "bg-red-500"
                  } text-white active:scale-98`}
                >
                  {activeTab === "buy" ? "Buy" : "Sell"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push("/register")}
                  className="font-semibold focus:ring-blue-200 text-center h-12 rounded-xl text-base px-4 py-2 my-4 bg-gray-200 text-neutral-900 hover:bg-gray-300 dark:bg-base-background-l2 dark:text-white dark:border dark:border-base-border-light/10 dark:hover:bg-base-background-l3 active:scale-98"
                >
                  Sign up to trade
                </button>
              )}
            </div>

            <div className="flex justify-between flex-row mt-1">
              <div className="flex flex-row gap-2">
                <div className="flex items-center">
                  <input
                    className="form-checkbox rounded border border-solid border-base-border-med bg-base-950 cursor-pointer h-5 w-5"
                    id="postOnly"
                    type="checkbox"
                  />
                  <label className="ml-2 text-xs">Post Only</label>
                </div>
                <div className="flex items-center">
                  <input
                    className="form-checkbox rounded border border-solid border-base-border-med bg-base-950 cursor-pointer h-5 w-5"
                    id="ioc"
                    type="checkbox"
                  />
                  <label className="ml-2 text-xs">IOC</label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LimitButton({ type, setType }: { type: string; setType: any }) {
  return (
    <div
      className="flex flex-col cursor-pointer justify-center py-2"
      onClick={() => setType("limit")}
    >
      <div
        className={`text-sm font-medium py-1 border-b-2 ${
          type === "limit"
            ? "border-accent-blue text-base-text-high-emphasis"
            : "border-transparent text-base-text-med-emphasis hover:border-base-text-high-emphasis hover:text-base-text-high-emphasis"
        }`}
      >
        Limit
      </div>
    </div>
  );
}

function MarketButton({ type, setType }: { type: string; setType: any }) {
  return (
    <div
      className="flex flex-col cursor-pointer justify-center py-2"
      onClick={() => setType("market")}
    >
      <div
        className={`text-sm font-medium py-1 border-b-2 ${
          type === "market"
            ? "border-accent-blue text-base-text-high-emphasis"
            : "border-b-2 border-transparent text-base-text-med-emphasis hover:border-base-text-high-emphasis hover:text-base-text-high-emphasis"
        } `}
      >
        Market
      </div>
    </div>
  );
}

function BuyButton({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: any;
}) {
  return (
    <div
      className={`flex flex-col -mb-0.5 flex-1 cursor-pointer justify-center border-b-2 p-4 ${
        activeTab === "buy"
          ? "border-b-green-border bg-green-500/10"
          : "border-b-base-border-med hover:border-b-base-border-focus"
      }`}
      onClick={() => setActiveTab("buy")}
    >
      <p
        className={`text-center text-sm font-semibold ${
          activeTab === "buy"
            ? " dark:text-white text-black dark:text-green-text"
            : "text-green-text"
        }`}
      >
        Buy
      </p>
    </div>
  );
}

function SellButton({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: any;
}) {
  return (
    <div
      className={`flex flex-col -mb-0.5 flex-1 cursor-pointer justify-center border-b-2 p-4 ${
        activeTab === "sell"
          ? "border-b-red-border bg-red-500/10"
          : "border-b-base-border-med hover:border-b-base-border-focus"
      }`}
      onClick={() => setActiveTab("sell")}
    >
      <p
        className={`text-center text-sm font-semibold ${
          activeTab === "sell"
            ? "dark:text-white text-black dark:text-red-text"
            : "text-red-text"
        }`}
      >
        Sell
      </p>
    </div>
  );
}
