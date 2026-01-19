"use client";

import { useRouter } from "next/navigation";
import { CiSearch } from "react-icons/ci";
import { useEffect, useState } from "react";
import { getTickers } from "../utils/httpClient";
import { useUser } from "../hooks/useUser";
import { useAuth } from "../context/AuthContext";

export const Appbar = () => {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [markets, setMarkets] = useState<any[]>([]);
  const [marketToShow, setMarketToShow] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const { user, loading } = useUser();
  const { logout } = useAuth();

  useEffect(() => {
    async function load() {
      const data = await getTickers();
      const filtered = data.filter((m: any) => !m.symbol.endsWith("PERP"));
      const sorted = filtered.sort(
        (a: any, b: any) => b.lastPrice - a.lastPrice,
      );
      setMarkets(sorted);
      setMarketToShow(sorted);
    }
    load();
  }, []);

  useEffect(() => {
    if (!value.trim()) {
      setMarketToShow(markets);
      return;
    }
    const filtered = markets.filter((m: any) =>
      m.symbol.toLowerCase().includes(value.toLowerCase()),
    );
    setMarketToShow(filtered);
  }, [value, markets]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenModal(false);
        setShowLogoutConfirm(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const confirmLogout = async () => {
    try {
      setLogoutLoading(true);
      await logout();
    } finally {
      setLogoutLoading(false);
      setShowLogoutConfirm(false);
    }
  };

  return (
    <>
      <div className="relative flex h-14 w-full flex-col justify-center">
        <div className="flex items-center justify-between">
          <div className="flex items-center flex-row">
            <a
              href="/"
              className="focus:none items-center rounded-lg text-center font-semibold hover:opacity-90 focus:ring-blue-200 focus:outline-hidden disabled:opacity-80 disabled:hover:opacity-80 flex flex-col justify-center bg-transparent h-8 text-sm p-0 xs:mr-6 mr-3 ml-4 shrink-0 sm:ml-[21px]"
            >
              <div className="flex items-center flex-row gap-1">
                {/* Dark mode logos */}
                <img
                  src="/favicon.ico"
                  alt="logo"
                  height={30}
                  width={30}
                  className="hidden dark:block"
                />
                <img
                  src="/logo-text.svg"
                  alt="logo"
                  height={70}
                  width={80}
                  className="hidden dark:block"
                />
                {/* Light mode logos */}
                <img
                  src="/logo-dark.png"
                  alt="logo"
                  height={30}
                  width={30}
                  className="block dark:hidden"
                />
                <img
                  src="/logo-text-dark.png"
                  alt="logo"
                  height={70}
                  width={80}
                  className="block dark:hidden"
                />
              </div>
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

          <div className="absolute left-1/2 hidden -translate-x-1/2 justify-self-center min-[1470px]:inline-flex">
            <div className="flex items-center justify-between flex-row bg-gray-100 dark:bg-base-background-l2 focus-within:ring-black dark:focus-within:ring-accent-blue w-[340px] flex-1 cursor-pointer overflow-hidden rounded-xl px-1 ring-0 focus-within:ring-2">
              <div className="flex items-center flex-row flex-1">
                <div className="mx-2">
                  <CiSearch className="text-slate-500" />
                </div>
                <input
                  placeholder="Search markets"
                  className="bg-gray-100 dark:bg-base-background-l2 text-high-emphasis placeholder-low-emphasis h-8 w-full border-0 p-0 text-sm font-normal outline-hidden focus:ring-0"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onClick={() => setOpenModal(true)}
                />
              </div>
            </div>
          </div>

          <div className="animate-in fade-in col-span-2 flex flex-row justify-self-end xl:col-span-1">
            {loading ? null : !user ? (
              <div className="flex flex-row">
                <a
                  className="bg-base-background-l2 my-auto mr-4 rounded-lg px-2 py-1.5 text-xs font-semibold text-nowrap dark:text-white text-black hover:opacity-90 sm:ml-4 sm:px-3 sm:text-sm"
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
              <div className="flex flex-row gap-1">
                <a
                  className="my-auto mr-2 rounded-lg bg-base-background-l2 px-2 py-1.5 text-xs font-semibold text-nowrap dark:text-white text-black hover:opacity-90 sm:px-3 sm:text-sm cursor-pointer"
                  href="/balance"
                >
                  Profile
                </a>

                <button
                  className="my-auto mr-2 rounded-lg bg-red-500 px-2 py-1.5 text-xs font-semibold text-nowrap dark:text-white text-black hover:opacity-90 hover:bg-red-600/80 sm:px-3 sm:text-sm cursor-pointer disabled:opacity-60"
                  onClick={() => setShowLogoutConfirm(true)}
                  disabled={logoutLoading}
                >
                  {logoutLoading ? "Logging out..." : "Logout"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 dark:bg-black/80 bg-white/80 border-black/10 backdrop-blur-sm flex justify-center items-center z-[300] px-4">
          <div className="w-full max-w-[420px] dark:bg-[#0c0c0c] bg-gray-100 rounded-2xl p-4 sm:p-5 border dark:border-white/10 border-black/10">
            <h2 className="text-black dark:text-white text-lg font-semibold mb-2">
              Confirm Logout
            </h2>
            <p className="text-gray-600 dark:text-gray-200 text-sm mb-5">
              Are you sure you want to log out?
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={logoutLoading}
                className="rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm text-white hover:opacity-90"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                disabled={logoutLoading}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600/80 disabled:opacity-60"
              >
                {logoutLoading ? "Logging out..." : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openModal && (
        <div
          className="fixed inset-0 dark:bg-black/80 backdrop-blur-sm flex justify-center items-start pt-16 sm:pt-28 z-[200] px-4"
          onClick={() => setOpenModal(false)}
        >
          <div
            className="w-full max-w-[500px] bg-[#0c0c0c] rounded-2xl p-4 sm:p-5 border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center bg-[#1a1a1a] px-3 py-2 rounded-xl border border-white/10 mb-4">
              <CiSearch className="text-slate-400 text-xl mr-2" />
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Search markets..."
                className="bg-transparent w-full outline-none text-white"
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {marketToShow.map((m: any) => (
                <div
                  key={m.symbol}
                  onClick={() => {
                    router.push(`/trade/${m.symbol}`);
                    setOpenModal(false);
                  }}
                  className="flex justify-between px-3 py-2 bg-[#141414] hover:bg-[#1f1f1f] rounded-lg cursor-pointer"
                >
                  <div className="text-white text-sm">{m.symbol}</div>
                  <div className="text-gray-400 text-sm">{m.lastPrice}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
