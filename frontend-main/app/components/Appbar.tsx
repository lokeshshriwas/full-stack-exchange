"use client";

import { usePathname, useRouter } from "next/navigation";
import { CiSearch } from "react-icons/ci";
import { useEffect, useState } from "react";
import { getTickers } from "../utils/httpClient";
import { useUser } from "../hooks/useUser";

export const Appbar = () => {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [markets, setMarkets] = useState<any[]>([]);
  const [marketToShow, setMarketToShow] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const { user, loading } = useUser();

  // Load tickers correctly
  useEffect(() => {
    async function load() {
      const data = await getTickers();
      const filtered = data.filter((m: any) => !m.symbol.endsWith("PERP"));
      const sorted = filtered.sort(
        (a: any, b: any) => b.lastPrice - a.lastPrice
      );
      setMarkets(sorted);
      setMarketToShow(sorted);
    }
    load();
  }, []);

  // Handle search
  useEffect(() => {
    if (!value.trim()) {
      setMarketToShow(markets);
      return;
    }
    const filtered = markets.filter((m: any) =>
      m.symbol.toLowerCase().includes(value.toLowerCase())
    );
    setMarketToShow(filtered);
  }, [value, markets]);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenModal(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <div className="relative flex h-14 w-full flex-col justify-center">
        <div className="flex items-center justify-between">
          {/* Left Section */}
          <div className="flex items-center flex-row">
            <a
              href="/"
              className="focus:none items-center rounded-lg text-center font-semibold hover:opacity-90 focus:ring-blue-200 focus:outline-hidden disabled:opacity-80 disabled:hover:opacity-80 flex flex-col justify-center bg-transparent h-8 text-sm p-0 xs:mr-6 mr-3 ml-4 shrink-0 sm:ml-[21px]"
            >
              LOGO
            </a>

            <div className="flex items-center justify-center flex-row xs:flex gap-5 sm:mx-4 sm:gap-8">
              <div
                onClick={() => router.push("/trade/BTC_USDC")}
                className="focus:none items-center rounded-lg text-center font-semibold hover:opacity-90 focus:ring-blue-200 focus:outline-hidden hover:cursor-pointer disabled:opacity-80 disabled:hover:opacity-80 flex flex-col justify-center bg-transparent h-8 text-xs p-0 text-med-emphasis dark:text-slate-200 text-slate-500"
              >
                Trade
              </div>
            </div>
          </div>

          {/* SEARCH INPUT */}
          <div className="absolute left-1/2 hidden -translate-x-1/2 justify-self-center min-[1470px]:inline-flex">
            <div className="flex items-center justify-between flex-row bg-gray-100 dark:bg-base-background-l2 focus-within:ring-black dark:focus-within:ring-accent-blue w-[340px] flex-1 cursor-pointer overflow-hidden rounded-xl px-1 ring-0 focus-within:ring-2">
              <div className="flex items-center flex-row flex-1">
                <div className="mx-2">
                  <CiSearch className="text-slate-500" />
                </div>
                <input
                  aria-label="Search markets"
                  placeholder="Search markets"
                  className="bg-gray-100 dark:bg-base-background-l2 text-high-emphasis placeholder-low-emphasis h-8 w-full border-0 p-0 text-sm font-normal outline-hidden focus:ring-0"
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onClick={() => setOpenModal(true)}
                />
              </div>
            </div>
          </div>

          {/* Right Auth Buttons */}
          <div className="animate-in fade-in col-span-2 flex flex-row justify-self-end xl:col-span-1">
            {loading ? null : !user ? (
              <div className="flex flex-row">
                <a
                  className="bg-base-background-l2  my-auto mr-4 rounded-lg px-2 py-1.5 text-xs font-semibold text-nowrap dark:text-white text-black hover:opacity-90 sm:ml-4 sm:px-3 sm:text-sm"
                  href="/login"
                >
                  Log in
                </a>
                <a
                  className="text-black my-auto mr-6 rounded-lg bg-white px-2 py-1.5 text-xs font-semibold text-nowrap hover:opacity-90 sm:px-3 sm:text-sm"
                  href="/register"
                >
                  Sign up
                </a>
              </div>
            ) : (
              <div className="flex flex-row gap-4">
                <a
                  className="my-auto mr-6 rounded-lg bg-base-background-l2 px-2 py-1.5 text-xs font-semibold text-nowrap dark:text-white text-black hover:opacity-90 sm:px-3 sm:text-sm cursor-pointer"
                  href="/balance"
                >
                  Profile
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {openModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-start pt-28 z-[200] animate-fadeIn"
          onClick={() => setOpenModal(false)}
        >
          <div
            className="w-[500px] bg-[#0c0c0c] rounded-2xl p-5 shadow-lg border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Bar Inside Modal */}
            <div className="flex items-center bg-[#1a1a1a] px-3 py-2 rounded-xl border border-white/10 mb-4">
              <CiSearch className="text-slate-400 text-xl mr-2" />
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Search markets..."
                className="bg-transparent w-full outline-none text-white placeholder:text-gray-500"
              />
              {value && (
                <button
                  className="text-gray-400 text-sm px-2"
                  onClick={() => setValue("")}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Results */}
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {marketToShow.length > 0 ? (
                marketToShow.map((m: any) => (
                  <div
                    key={m.symbol}
                    onClick={() => {
                      router.push(`/trade/${m.symbol}`);
                      setOpenModal(false);
                    }}
                    className="flex items-center justify-between px-3 py-2 bg-[#141414] hover:bg-[#1f1f1f] rounded-lg cursor-pointer transition-all"
                  >
                    <div className="text-white text-sm">{m.symbol}</div>
                    <div className="text-gray-400 text-sm">{m.lastPrice}</div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-10">
                  No markets found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
