"use client";

import React, { useState, useEffect } from "react";
import {
  FaWallet,
  FaPlus,
  FaCoins,
  FaLock,
  FaCheckCircle,
  FaTimesCircle,
  FaSpinner,
  FaBitcoin,
  FaEthereum,
} from "react-icons/fa";
import {
  SiSolana,
  SiBinance,
  SiRipple,
  SiCardano,
  SiDogecoin,
  SiPolygon,
} from "react-icons/si";
import { RiCoinLine } from "react-icons/ri";
import { IoClose } from "react-icons/io5";
import { BiDollarCircle } from "react-icons/bi";
import { HiMiniArrowsRightLeft } from "react-icons/hi2";
import { useAuth } from "../context/AuthContext";

const API_BASE_URL = "http://localhost:8080/api/v2";

// Types
interface Balance {
  user_id: number;
  asset_id: number;
  available: string;
  locked: string;
  symbol: string;
  decimals: number;
}

// Icon mapping
const getAssetIcon = (symbol: string): React.ReactNode => {
  const iconMap: { [key: string]: React.ReactNode } = {
    USDC: <BiDollarCircle />,
    BTC: <FaBitcoin />,
    ETH: <FaEthereum />,
    SOL: <SiSolana />,
    BNB: <SiBinance />,
    XRP: <SiRipple />,
    ADA: <SiCardano />,
    DOGE: <SiDogecoin />,
    MATIC: <SiPolygon />,
  };
  return iconMap[symbol] || <RiCoinLine />;
};

// Toast Component
const Toast = ({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-lg border ${
        type === "success"
          ? "bg-black border-white/20 text-white"
          : "bg-black border-red-500/50 text-red-400"
      }`}
      style={{ animation: "slideIn 0.3s ease-out" }}
    >
      {type === "success" ? (
        <FaCheckCircle className="text-lg text-white" />
      ) : (
        <FaTimesCircle className="text-lg" />
      )}
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70">
        <IoClose />
      </button>
    </div>
  );
};

// USDC Balance Card (Main Card)
const USDCBalanceCard = ({
  balance,
  onAddClick,
}: {
  balance: Balance | null;
  onAddClick: () => void;
}) => {
  const available = balance ? parseFloat(balance.available) : 0;
  const locked = balance ? parseFloat(balance.locked) : 0;
  const total = available + locked;

  return (
    <div className="bg-black border border-white/20 rounded-2xl p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center text-3xl">
            <BiDollarCircle />
          </div>
          <div>
            <h3 className="text-white font-bold text-2xl">USDC</h3>
            <p className="text-white/40 text-sm">Trading Currency</p>
          </div>
        </div>
        <button
          onClick={onAddClick}
          className="flex items-center gap-2 bg-white text-black font-bold px-6 py-3 rounded-lg hover:bg-white/90 transition-all"
        >
          <FaPlus />
          Add Funds
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
          <p className="text-white/40 text-sm mb-2 flex items-center gap-2">
            <FaCoins className="text-white/30" /> Available
          </p>
          <p className="text-white font-mono font-bold text-2xl">
            $
            {available.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
          <p className="text-white/40 text-sm mb-2 flex items-center gap-2">
            <FaLock className="text-white/30" /> In Orders
          </p>
          <p className="text-white/60 font-mono font-bold text-2xl">
            $
            {locked.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <div className="bg-white/5 rounded-xl p-5 border border-white/10">
          <p className="text-white/40 text-sm mb-2">Total Balance</p>
          <p className="text-white font-mono font-bold text-2xl">
            $
            {total.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>
    </div>
  );
};

// Other Asset Balance Card
const AssetBalanceCard = ({ balance }: { balance: Balance }) => {
  const available = parseFloat(balance.available);
  const locked = parseFloat(balance.locked);
  const total = available + locked;

  return (
    <div className="bg-black border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xl text-white">
            {getAssetIcon(balance.symbol)}
          </div>
          <div>
            <h3 className="text-white font-bold">{balance.symbol}</h3>
            <p className="text-white/30 text-xs">Spot Balance</p>
          </div>
        </div>
        <HiMiniArrowsRightLeft className="text-white/20" />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-white/40 text-sm">Available</span>
          <span className="text-white font-mono">
            {available.toLocaleString(undefined, {
              minimumFractionDigits: 4,
              maximumFractionDigits: 8,
            })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40 text-sm">Locked</span>
          <span className="text-white/50 font-mono">
            {locked.toLocaleString(undefined, {
              minimumFractionDigits: 4,
              maximumFractionDigits: 8,
            })}
          </span>
        </div>
        <div className="border-t border-white/10 pt-2 mt-2">
          <div className="flex justify-between">
            <span className="text-white/40 text-sm">Total</span>
            <span className="text-white font-mono font-semibold">
              {total.toLocaleString(undefined, {
                minimumFractionDigits: 4,
                maximumFractionDigits: 8,
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Add USDC Modal
const AddUSDCModal = ({
  isOpen,
  onClose,
  onAddBalance,
  isLoading,
  currentBalance,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAddBalance: (amount: string) => void;
  isLoading: boolean;
  currentBalance: number;
}) => {
  const [amount, setAmount] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount && parseFloat(amount) > 0) {
      onAddBalance(amount);
      setAmount("");
    }
  };

  const quickAmounts = ["100", "500", "1000", "5000", "10000", "50000"];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-black border border-white/20 rounded-2xl p-8 w-full max-w-lg"
        style={{ animation: "scaleIn 0.2s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center text-2xl">
              <BiDollarCircle />
            </div>
            <div>
              <h2 className="text-white text-xl font-bold">Add USDC</h2>
              <p className="text-white/40 text-sm">Demo trading funds</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg"
          >
            <IoClose className="text-2xl" />
          </button>
        </div>

        {/* Current Balance Display */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
          <p className="text-white/40 text-sm mb-1">Current USDC Balance</p>
          <p className="text-white font-mono font-bold text-2xl">
            $
            {currentBalance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Amount Input */}
          <div>
            <label className="block text-white/70 text-sm font-medium mb-3">
              Amount to Add
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-xl">
                $
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full bg-black border border-white/20 rounded-xl pl-10 pr-20 py-4 text-white text-xl font-mono placeholder-white/20 focus:outline-none focus:border-white/50 transition-all"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
                USDC
              </span>
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div>
            <label className="block text-white/70 text-sm font-medium mb-3">
              Quick Select
            </label>
            <div className="grid grid-cols-3 gap-3">
              {quickAmounts.map((quickAmount) => (
                <button
                  key={quickAmount}
                  type="button"
                  onClick={() => setAmount(quickAmount)}
                  className={`px-4 py-3 rounded-lg font-medium transition-all border ${
                    amount === quickAmount
                      ? "bg-white text-black border-white"
                      : "bg-black text-white/70 border-white/20 hover:border-white/40 hover:text-white"
                  }`}
                >
                  ${parseInt(quickAmount).toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* New Balance Preview */}
          {amount && parseFloat(amount) > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <span className="text-white/40 text-sm">New Balance</span>
                <span className="text-white font-mono font-bold text-lg">
                  $
                  {(currentBalance + parseFloat(amount)).toLocaleString(
                    undefined,
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !amount || parseFloat(amount) <= 0}
            className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-white/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <FaSpinner className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <FaPlus />
                Add ${amount ? parseFloat(amount).toLocaleString() : "0"} USDC
              </>
            )}
          </button>

          {/* Disclaimer */}
          <p className="text-white/30 text-xs text-center">
            This is demo money for paper trading. No real funds are involved.
          </p>
        </form>
      </div>
    </div>
  );
};

// Main Balance Page
export default function BalancePage() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingBalance, setIsAddingBalance] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const { user, isLoading: authLoading } = useAuth();

  // Demo user ID - Replace with actual auth
  const userId = user?.id;

  // Get USDC balance
  const usdcBalance = balances.find((b) => b.symbol === "USDC") || null;
  const usdcAvailable = usdcBalance ? parseFloat(usdcBalance.available) : 0;

  // Get other balances (non-USDC)
  const otherBalances = balances.filter((b) => b.symbol !== "USDC");

  // Fetch all balances
  const fetchBalances = async () => {
    if (!userId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/balances/${userId}`);
      const data = await response.json();
      if (response.ok) {
        setBalances(data.balances);
      }
    } catch (error) {
      console.error("Error fetching balances:", error);
    }
  };

  // Initial load
  useEffect(() => {
    if (userId) {
      const loadData = async () => {
        setIsLoading(true);
        await fetchBalances();
        setIsLoading(false);
      };
      loadData();
    }
  }, [userId]);

  // Add USDC handler
  const handleAddUSDC = async (amount: string) => {
    setIsAddingBalance(true);
    try {
      const response = await fetch(`${API_BASE_URL}/balances/add-usdc`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          amount,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setToast({
          message: `Successfully added $${parseFloat(
            amount
          ).toLocaleString()} USDC`,
          type: "success",
        });
        setIsModalOpen(false);
        await fetchBalances();
      } else {
        setToast({
          message: data.error || "Failed to add USDC",
          type: "error",
        });
      }
    } catch (error) {
      setToast({
        message: "Connection error. Please try again.",
        type: "error",
      });
    } finally {
      setIsAddingBalance(false);
    }
  };

  if (isLoading || (authLoading && !user)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <FaSpinner className="text-4xl text-white animate-spin" />
          <p className="text-white/50">Loading wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Modal */}
      <AddUSDCModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddBalance={handleAddUSDC}
        isLoading={isAddingBalance}
        currentBalance={usdcAvailable}
      />

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-5 mb-10">
          <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center">
            <FaWallet className="text-2xl" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Wallet</h1>
            <p className="text-white/40">Manage your trading balance</p>
          </div>
        </div>

        {/* Demo Banner */}
        <div className="border border-white/10 rounded-xl p-4 mb-8 flex items-center gap-4 bg-white/5">
          <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center flex-shrink-0">
            <FaCoins className="text-white/50" />
          </div>
          <div>
            <p className="text-white font-medium">Paper Trading Mode</p>
            <p className="text-white/40 text-sm">
              Add USDC to start trading. Use USDC to buy other cryptocurrencies.
            </p>
          </div>
        </div>

        {/* USDC Balance Card */}
        <div className="mb-10">
          <USDCBalanceCard
            balance={usdcBalance}
            onAddClick={() => setIsModalOpen(true)}
          />
        </div>

        {/* Other Holdings */}
        {otherBalances.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h3 className="text-xl font-bold text-white">Your Holdings</h3>
              <span className="text-white/30 text-sm">
                ({otherBalances.length} assets)
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {otherBalances.map((balance) => (
                <AssetBalanceCard key={balance.asset_id} balance={balance} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State for Holdings */}
        {otherBalances.length === 0 && (
          <div className="border border-white/10 rounded-xl p-10 text-center">
            <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center mx-auto mb-4">
              <HiMiniArrowsRightLeft className="text-2xl text-white/20" />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">
              No Holdings Yet
            </h3>
            <p className="text-white/40 text-sm mb-6">
              Start trading to acquire other cryptocurrencies
            </p>
            {usdcAvailable === 0 && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 bg-white text-black font-bold px-6 py-3 rounded-lg hover:bg-white/90 transition-all"
              >
                <FaPlus />
                Add USDC to Start
              </button>
            )}
          </div>
        )}

        {/* How It Works */}
        <div className="mt-14 border border-white/10 rounded-xl p-8">
          <h3 className="text-white font-bold text-lg mb-6">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold flex-shrink-0">
                1
              </div>
              <div>
                <p className="text-white font-medium mb-1">Add USDC</p>
                <p className="text-white/40 text-sm">
                  Deposit demo USDC to your wallet
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold flex-shrink-0">
                2
              </div>
              <div>
                <p className="text-white font-medium mb-1">Trade</p>
                <p className="text-white/40 text-sm">
                  Buy crypto using your USDC balance
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold flex-shrink-0">
                3
              </div>
              <div>
                <p className="text-white font-medium mb-1">Manage</p>
                <p className="text-white/40 text-sm">
                  Track your portfolio and positions
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Styles */}
      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        ::-webkit-scrollbar {
          width: 6px;
        }

        ::-webkit-scrollbar-track {
          background: #000;
        }

        ::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #555;
        }

        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}
