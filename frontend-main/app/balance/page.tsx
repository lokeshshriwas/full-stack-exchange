"use client";

import React, { useState, useEffect } from "react";
import {
  FaWallet,
  FaPlus,
  FaCoins,
  FaSpinner,
  FaBitcoin,
  FaEthereum,
} from "react-icons/fa";
import {
  SiSolana,
  SiBinance,
  SiRipple,
  SiDogecoin,
  SiChainlink,
  SiPolygon,
} from "react-icons/si";
import { BsCurrencyExchange } from "react-icons/bs";
import { RiCoinLine } from "react-icons/ri";
import { BiDollarCircle } from "react-icons/bi";
import { HiMiniArrowsRightLeft } from "react-icons/hi2";
import { FaUserCircle } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import AddCryptoModal from "../components/balance/AddCryptoModal";
import { Balance, Cryptocurrency } from "../utils/types";
import USDCBalanceCard from "../components/balance/USDCBalanceCard";
import AssetBalanceCard from "../components/balance/AssetBalanceCard";

const API_BASE_URL = "http://localhost:8080/api/v2";

// Available cryptocurrencies list
export const AVAILABLE_CRYPTOCURRENCIES: Cryptocurrency[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    icon: <BiDollarCircle />,
    decimals: 6,
    isStablecoin: true,
  },
  { symbol: "BTC", name: "Bitcoin", icon: <FaBitcoin />, decimals: 8 },
  { symbol: "ETH", name: "Ethereum", icon: <FaEthereum />, decimals: 18 },
  { symbol: "BNB", name: "BNB", icon: <SiBinance />, decimals: 18 },
  { symbol: "SOL", name: "Solana", icon: <SiSolana />, decimals: 9 },
  { symbol: "AAVE", name: "Aave", icon: <BsCurrencyExchange />, decimals: 18 },
  { symbol: "HYPE", name: "Hype", icon: <BsCurrencyExchange />, decimals: 18 },
  { symbol: "LINK", name: "Chainlink", icon: <SiChainlink />, decimals: 18 },
  { symbol: "TRUMP", name: "Trump", icon: <BsCurrencyExchange />, decimals: 6 },
  {
    symbol: "UNI",
    name: "Uniswap",
    icon: <BsCurrencyExchange />,
    decimals: 18,
  },
  { symbol: "XRP", name: "Ripple", icon: <SiRipple />, decimals: 6 },
  { symbol: "APT", name: "Aptos", icon: <BsCurrencyExchange />, decimals: 8 },
  { symbol: "SUI", name: "Sui", icon: <BsCurrencyExchange />, decimals: 9 },
  {
    symbol: "ZRO",
    name: "LayerZero",
    icon: <BsCurrencyExchange />,
    decimals: 18,
  },
  {
    symbol: "RENDER",
    name: "Render",
    icon: <BsCurrencyExchange />,
    decimals: 8,
  },
  {
    symbol: "USDT",
    name: "Tether",
    icon: <BiDollarCircle />,
    decimals: 6,
    isStablecoin: true,
  },
  { symbol: "RAY", name: "Raydium", icon: <BsCurrencyExchange />, decimals: 6 },
  { symbol: "0G", name: "0G", icon: <BsCurrencyExchange />, decimals: 18 },
  {
    symbol: "LDO",
    name: "Lido DAO",
    icon: <BsCurrencyExchange />,
    decimals: 18,
  },
  {
    symbol: "WLD",
    name: "Worldcoin",
    icon: <BsCurrencyExchange />,
    decimals: 18,
  },
  { symbol: "ONDO", name: "Ondo", icon: <BsCurrencyExchange />, decimals: 18 },
  {
    symbol: "WIF",
    name: "dogwifhat",
    icon: <BsCurrencyExchange />,
    decimals: 6,
  },
  { symbol: "JTO", name: "Jito", icon: <BsCurrencyExchange />, decimals: 9 },
  { symbol: "MET", name: "Met", icon: <BsCurrencyExchange />, decimals: 18 },
  { symbol: "ME", name: "ME", icon: <BsCurrencyExchange />, decimals: 6 },
  { symbol: "ENA", name: "Ethena", icon: <BsCurrencyExchange />, decimals: 18 },
  {
    symbol: "APE",
    name: "ApeCoin",
    icon: <BsCurrencyExchange />,
    decimals: 18,
  },
  { symbol: "JUP", name: "Jupiter", icon: <BsCurrencyExchange />, decimals: 6 },
  { symbol: "DRIFT", name: "Drift", icon: <BsCurrencyExchange />, decimals: 9 },
  { symbol: "IO", name: "IO", icon: <BsCurrencyExchange />, decimals: 18 },
  { symbol: "WLFI", name: "WLFI", icon: <BsCurrencyExchange />, decimals: 18 },
  { symbol: "XPL", name: "XPL", icon: <BsCurrencyExchange />, decimals: 18 },
  { symbol: "DOGE", name: "Dogecoin", icon: <SiDogecoin />, decimals: 8 },
  { symbol: "SEI", name: "Sei", icon: <BsCurrencyExchange />, decimals: 6 },
  { symbol: "POL", name: "Polygon", icon: <SiPolygon />, decimals: 18 },
  { symbol: "2Z", name: "2Z", icon: <BsCurrencyExchange />, decimals: 18 },
  {
    symbol: "STRK",
    name: "Starknet",
    icon: <BsCurrencyExchange />,
    decimals: 18,
  },
  {
    symbol: "FLOCK",
    name: "Flock",
    icon: <BsCurrencyExchange />,
    decimals: 18,
  },
  { symbol: "ES", name: "ES", icon: <BsCurrencyExchange />, decimals: 18 },
  { symbol: "TNSR", name: "Tensor", icon: <BsCurrencyExchange />, decimals: 9 },
  {
    symbol: "CLOUD",
    name: "Cloud",
    icon: <BsCurrencyExchange />,
    decimals: 18,
  },
  { symbol: "WCT", name: "WCT", icon: <BsCurrencyExchange />, decimals: 18 },
  {
    symbol: "SONIC",
    name: "Sonic",
    icon: <BsCurrencyExchange />,
    decimals: 18,
  },
  { symbol: "PIPE", name: "Pipe", icon: <BsCurrencyExchange />, decimals: 18 },
  {
    symbol: "PYTH",
    name: "Pyth Network",
    icon: <BsCurrencyExchange />,
    decimals: 6,
  },
  {
    symbol: "KMNO",
    name: "Kamino",
    icon: <BsCurrencyExchange />,
    decimals: 18,
  },
  { symbol: "DEEP", name: "Deep", icon: <BsCurrencyExchange />, decimals: 18 },
  { symbol: "W", name: "Wormhole", icon: <BsCurrencyExchange />, decimals: 18 },
  {
    symbol: "SWTCH",
    name: "Switch",
    icon: <BsCurrencyExchange />,
    decimals: 18,
  },
  { symbol: "BLUE", name: "Blue", icon: <BsCurrencyExchange />, decimals: 18 },
  { symbol: "MON", name: "Mon", icon: <BsCurrencyExchange />, decimals: 18 },
  { symbol: "PRCL", name: "Parcl", icon: <BsCurrencyExchange />, decimals: 18 },
  {
    symbol: "STABLE",
    name: "Stable",
    icon: <BsCurrencyExchange />,
    decimals: 6,
  },
  {
    symbol: "PENGU",
    name: "Pudgy Penguins",
    icon: <BsCurrencyExchange />,
    decimals: 6,
  },
  { symbol: "PUMP", name: "Pump", icon: <BsCurrencyExchange />, decimals: 6 },
  {
    symbol: "BOME",
    name: "Book of Meme",
    icon: <BsCurrencyExchange />,
    decimals: 6,
  },
  { symbol: "WEN", name: "Wen", icon: <BsCurrencyExchange />, decimals: 6 },
  { symbol: "BONK", name: "Bonk", icon: <BsCurrencyExchange />, decimals: 5 },
  {
    symbol: "SHIB",
    name: "Shiba Inu",
    icon: <BsCurrencyExchange />,
    decimals: 18,
  },
  { symbol: "PEPE", name: "Pepe", icon: <BsCurrencyExchange />, decimals: 18 },
];

// Icon mapping
export const getAssetIcon = (symbol: string): React.ReactNode => {
  const crypto = AVAILABLE_CRYPTOCURRENCIES.find((c) => c.symbol === symbol);
  return crypto?.icon || <RiCoinLine />;
};

// Get crypto info
export const getCryptoInfo = (symbol: string): Cryptocurrency | undefined => {
  return AVAILABLE_CRYPTOCURRENCIES.find((c) => c.symbol === symbol);
};

// Main Balance Page
export default function BalancePage() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingBalance, setIsAddingBalance] = useState(false);
  const [preSelectedSymbol, setPreSelectedSymbol] = useState<
    string | undefined
  >(undefined);

  const { user, isLoading: authLoading } = useAuth();

  // Demo user ID - Replace with actual auth
  const userId = user?.id;

  // Get USDC balance
  const usdcBalance = balances.find((b) => b.symbol === "USDC") || null;

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

  // Open modal with optional pre-selected symbol
  const openAddModal = (symbol?: string) => {
    setPreSelectedSymbol(symbol);
    setIsModalOpen(true);
  };

  // Close modal and reset
  const closeAddModal = () => {
    setIsModalOpen(false);
    setPreSelectedSymbol(undefined);
  };

  // Add crypto handler - generic for any cryptocurrency
  const handleAddCrypto = async (symbol: string, amount: string) => {
    setIsAddingBalance(true);
    try {
      const response = await fetch(`${API_BASE_URL}/balances/add-crypto`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          symbol,
          amount,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const cryptoInfo = getCryptoInfo(symbol);
        const formattedAmount = cryptoInfo?.isStablecoin
          ? `$${parseFloat(amount).toLocaleString()}`
          : `${parseFloat(amount).toLocaleString()} ${symbol}`;

        toast.success(`Successfully added ${formattedAmount}`);
        closeAddModal();
        await fetchBalances();
      } else {
        toast.error(data.error || `Failed to add ${symbol}`);
      }
    } catch (error) {
      toast.error("Connection error. Please try again.");
    } finally {
      setIsAddingBalance(false);
    }
  };

  if (isLoading || (authLoading && !user)) {
    return (
      <div className="min-h-screen bg-base-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <FaSpinner className="text-4xl text-base-text-high-emphasis animate-spin" />
          <p className="text-base-text-med-emphasis">Loading wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-background">
      {/* Modal */}
      <AddCryptoModal
        isOpen={isModalOpen}
        onClose={closeAddModal}
        onAddBalance={handleAddCrypto}
        isLoading={isAddingBalance}
        balances={balances}
        preSelectedSymbol={preSelectedSymbol}
      />

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-base-background-l2 text-base-text-high-emphasis flex items-center justify-center">
              <FaWallet className="text-2xl" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-base-text-high-emphasis">
                Wallet
              </h1>
              <p className="text-base-text-med-emphasis">
                Manage your trading balance
              </p>
            </div>
          </div>
          <button
            onClick={() => openAddModal()}
            className="flex items-center gap-2 bg-base-text-high-emphasis dark:text-black text-white font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-all"
          >
            <FaPlus />
            Add Crypto
          </button>
        </div>

        {/* User Profile Section */}
        <div className="mb-8 border border-base-border-light rounded-xl p-6 bg-gradient-to-r from-base-background-l2 to-base-background-l1 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 pointer-events-none"></div>
          <div className="relative flex items-center gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-2 border-base-border-light flex items-center justify-center overflow-hidden">
              <FaUserCircle className="text-5xl text-base-text-med-emphasis" />
            </div>
            {/* User Info */}
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-base-text-high-emphasis">
                {user?.fullName || user?.email?.split("@")[0] || "Trader"}
              </h2>
              <p className="text-base-text-med-emphasis text-sm">
                {user?.email || "demo@exchange.com"}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                  <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                  Active
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-base-background-l2 text-base-text-med-emphasis border border-base-border-light">
                  Paper Trading
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Demo Banner */}
        <div className="border border-base-border-light rounded-xl p-4 mb-8 flex items-center gap-4 bg-base-background-l2">
          <div className="w-10 h-10 rounded-full border border-base-border-med flex items-center justify-center shrink-0">
            <FaCoins className="text-base-text-med-emphasis" />
          </div>
          <div>
            <p className="text-base-text-high-emphasis font-medium">
              Paper Trading Mode
            </p>
            <p className="text-base-text-med-emphasis text-sm">
              Add any cryptocurrency to your wallet. Use USDC to buy other
              cryptocurrencies or add them directly.
            </p>
          </div>
        </div>

        {/* USDC Balance Card */}
        <div className="mb-10">
          <USDCBalanceCard
            balance={usdcBalance}
            onAddClick={() => openAddModal("USDC")}
          />
        </div>

        {/* Other Holdings */}
        {otherBalances.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-base-text-high-emphasis">
                  Your Holdings
                </h3>
                <span className="text-base-text-med-emphasis text-sm">
                  ({otherBalances.length} assets)
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {otherBalances.map((balance) => (
                <AssetBalanceCard
                  key={balance.asset_id}
                  balance={balance}
                  onAddClick={openAddModal}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State for Holdings */}
        {otherBalances.length === 0 && (
          <div className="border border-base-border-light rounded-xl p-10 text-center">
            <div className="w-16 h-16 rounded-full border border-base-border-light flex items-center justify-center mx-auto mb-4">
              <HiMiniArrowsRightLeft className="text-2xl text-base-text-med-emphasis" />
            </div>
            <h3 className="text-base-text-high-emphasis font-bold text-lg mb-2">
              No Holdings Yet
            </h3>
            <p className="text-base-text-med-emphasis text-sm mb-6">
              Start trading to acquire other cryptocurrencies or add them
              directly
            </p>
            <button
              onClick={() => openAddModal()}
              className="inline-flex items-center gap-2 bg-base-text-high-emphasis dark:text-black text-white font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-all"
            >
              <FaPlus />
              Add Cryptocurrency
            </button>
          </div>
        )}

        {/* How It Works */}
        <div className="mt-14 border border-base-border-light rounded-xl p-8">
          <h3 className="text-base-text-high-emphasis font-bold text-lg mb-6">
            How It Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-base-background-l2 flex items-center justify-center text-base-text-high-emphasis font-bold shrink-0">
                1
              </div>
              <div>
                <p className="text-base-text-high-emphasis font-medium mb-1">
                  Add Crypto
                </p>
                <p className="text-base-text-med-emphasis text-sm">
                  Deposit any demo cryptocurrency to your wallet
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-base-background-l2 flex items-center justify-center text-base-text-high-emphasis font-bold shrink-0">
                2
              </div>
              <div>
                <p className="text-base-text-high-emphasis font-medium mb-1">
                  Trade
                </p>
                <p className="text-base-text-med-emphasis text-sm">
                  Buy and sell crypto using your balances
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-base-background-l2 flex items-center justify-center text-base-text-high-emphasis font-bold shrink-0">
                3
              </div>
              <div>
                <p className="text-base-text-high-emphasis font-medium mb-1">
                  Manage
                </p>
                <p className="text-base-text-med-emphasis text-sm">
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
