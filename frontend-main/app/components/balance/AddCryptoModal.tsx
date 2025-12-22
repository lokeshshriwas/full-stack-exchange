"use client"
import { AVAILABLE_CRYPTOCURRENCIES, getCryptoInfo } from "@/app/balance/page";
import { Balance, Cryptocurrency } from "@/app/utils/types";
import { useEffect, useState } from "react";
import { FaArrowLeft, FaCoins, FaPlus, FaSearch, FaSpinner } from "react-icons/fa";
import { IoClose } from "react-icons/io5";

const AddCryptoModal = ({
  isOpen,
  onClose,
  onAddBalance,
  isLoading,
  balances,
  preSelectedSymbol,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAddBalance: (symbol: string, amount: string) => void;
  isLoading: boolean;
  balances: Balance[];
  preSelectedSymbol?: string;
}) => {
  const [step, setStep] = useState<"select" | "amount">("select");
  const [selectedCrypto, setSelectedCrypto] = useState<Cryptocurrency | null>(null);
  const [amount, setAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Reset state when modal opens/closes or preSelectedSymbol changes
  useEffect(() => {
    if (isOpen) {
      if (preSelectedSymbol) {
        const crypto = getCryptoInfo(preSelectedSymbol);
        if (crypto) {
          setSelectedCrypto(crypto);
          setStep("amount");
        }
      } else {
        setStep("select");
        setSelectedCrypto(null);
      }
      setAmount("");
      setSearchQuery("");
    }
  }, [isOpen, preSelectedSymbol]);

  const handleSelectCrypto = (crypto: Cryptocurrency) => {
    setSelectedCrypto(crypto);
    setStep("amount");
  };

  const handleBack = () => {
    setStep("select");
    setSelectedCrypto(null);
    setAmount("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCrypto && amount && parseFloat(amount) > 0) {
      onAddBalance(selectedCrypto.symbol, amount);
      setAmount("");
    }
  };

  const handleClose = () => {
    setStep("select");
    setSelectedCrypto(null);
    setAmount("");
    setSearchQuery("");
    onClose();
  };

  // Get current balance for selected crypto
  const getCurrentBalance = (symbol: string): number => {
    const balance = balances.find((b) => b.symbol === symbol);
    return balance ? parseFloat(balance.available) : 0;
  };

  // Filter cryptocurrencies based on search
  const filteredCryptos = AVAILABLE_CRYPTOCURRENCIES.filter(
    (crypto) =>
      crypto.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      crypto.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Quick amounts based on crypto type
  const getQuickAmounts = (crypto: Cryptocurrency): string[] => {
    if (crypto.isStablecoin) {
      return ["100", "500", "1000", "5000", "10000", "50000"];
    }
    switch (crypto.symbol) {
      case "BTC":
        return ["0.01", "0.05", "0.1", "0.5", "1", "5"];
      case "ETH":
        return ["0.1", "0.5", "1", "5", "10", "50"];
      case "SOL":
        return ["1", "5", "10", "50", "100", "500"];
      default:
        return ["10", "50", "100", "500", "1000", "5000"];
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 dark:bg-black bg-white" onClick={handleClose} />

      {/* Modal */}
      <div
        className="relative bg-base-background border border-base-border-light rounded-2xl w-full max-w-lg max-h-[90vh]  overflow-y-scroll [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ animation: "scaleIn 0.2s ease-out" }}
      >
        {step === "select" ? (
          // Step 1: Select Cryptocurrency
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-base-border-light">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-base-background-l2 border border-base-border-light flex items-center justify-center">
                  <FaCoins className="text-xl text-base-text-high-emphasis" />
                </div>
                <div>
                  <h2 className="text-base-text-high-emphasis text-xl font-bold">
                    Add Cryptocurrency
                  </h2>
                  <p className="text-base-text-med-emphasis text-sm">
                    Select asset to add
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-base-text-med-emphasis hover:text-base-text-high-emphasis transition-colors p-2 hover:bg-base-background-l2 rounded-lg"
              >
                <IoClose className="text-2xl" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-base-border-light">
              <div className="relative">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-text-med-emphasis" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search cryptocurrencies..."
                  className="w-full bg-base-background-l2 border border-base-border-light rounded-xl pl-11 pr-4 py-3 text-base-text-high-emphasis placeholder-base-text-med-emphasis focus:outline-none focus:border-base-border-med transition-all"
                />
              </div>
            </div>

            {/* Crypto List */}
            <div className="overflow-y-auto max-h-[400px] p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="space-y-2">
                {filteredCryptos.map((crypto) => {
                  const currentBalance = getCurrentBalance(crypto.symbol);
                  return (
                    <button
                      key={crypto.symbol}
                      onClick={() => handleSelectCrypto(crypto)}
                      className="w-full flex items-center justify-between p-4 rounded-xl border border-base-border-light hover:border-base-border-med hover:bg-base-background-l2 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-base-background-l2 border border-base-border-light flex items-center justify-center text-2xl text-base-text-high-emphasis group-hover:border-base-border-med transition-all">
                          {crypto.icon}
                        </div>
                        <div className="text-left">
                          <h3 className="text-base-text-high-emphasis font-bold">
                            {crypto.symbol}
                          </h3>
                          <p className="text-base-text-med-emphasis text-sm">
                            {crypto.name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base-text-high-emphasis font-mono">
                          {currentBalance > 0
                            ? currentBalance.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: crypto.isStablecoin ? 2 : 8,
                              })
                            : "0.00"}
                        </p>
                        <p className="text-base-text-med-emphasis text-xs">
                          Balance
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {filteredCryptos.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-base-text-med-emphasis">
                    No cryptocurrencies found
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          // Step 2: Enter Amount
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-base-border-light">
              <div className="flex items-center gap-4">
                {!preSelectedSymbol && (
                  <button
                    onClick={handleBack}
                    className="p-2 hover:bg-base-background-l2 rounded-lg transition-all text-base-text-med-emphasis hover:text-base-text-high-emphasis"
                  >
                    <FaArrowLeft />
                  </button>
                )}
                <div className="w-12 h-12 rounded-full bg-base-text-high-emphasis dark:text-black text-white flex items-center justify-center text-2xl">
                  {selectedCrypto?.icon}
                </div>
                <div>
                  <h2 className="text-base-text-high-emphasis text-xl font-bold">
                    Add {selectedCrypto?.symbol}
                  </h2>
                  <p className="text-base-text-med-emphasis text-sm">
                    {selectedCrypto?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-base-text-med-emphasis hover:text-base-text-high-emphasis transition-colors p-2 hover:bg-base-background-l2 rounded-lg"
              >
                <IoClose className="text-2xl" />
              </button>
            </div>

            {/* Amount Form */}
            <div className="p-6">
              {/* Current Balance Display */}
              <div className="bg-base-background-l2 border border-base-border-light rounded-xl p-5 mb-6">
                <p className="text-base-text-med-emphasis text-sm mb-1">
                  Current {selectedCrypto?.symbol} Balance
                </p>
                <p className="text-base-text-high-emphasis font-mono font-bold text-2xl">
                  {selectedCrypto?.isStablecoin && "$"}
                  {getCurrentBalance(selectedCrypto?.symbol || "").toLocaleString(
                    undefined,
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: selectedCrypto?.isStablecoin ? 2 : 8,
                    }
                  )}
                  {!selectedCrypto?.isStablecoin && ` ${selectedCrypto?.symbol}`}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Amount Input */}
                <div>
                  <label className="block text-base-text-high-emphasis text-sm font-medium mb-3">
                    Amount to Add
                  </label>
                  <div className="relative">
                    {selectedCrypto?.isStablecoin && (
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base-text-med-emphasis text-xl">
                        $
                      </span>
                    )}
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="any"
                      className={`w-full bg-base-background border border-base-border-med rounded-xl ${
                        selectedCrypto?.isStablecoin ? "pl-10" : "pl-4"
                      } pr-20 py-4 text-base-text-high-emphasis text-xl font-mono placeholder-base-text-med-emphasis focus:outline-none focus:border-base-text-high-emphasis transition-all`}
                      required
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base-text-med-emphasis">
                      {selectedCrypto?.symbol}
                    </span>
                  </div>
                </div>

                {/* Quick Amount Buttons */}
                <div>
                  <label className="block text-base-text-high-emphasis text-sm font-medium mb-3">
                    Quick Select
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {selectedCrypto &&
                      getQuickAmounts(selectedCrypto).map((quickAmount) => (
                        <button
                          key={quickAmount}
                          type="button"
                          onClick={() => setAmount(quickAmount)}
                          className={`px-4 py-3 rounded-lg font-medium transition-all border ${
                            amount === quickAmount
                              ? "bg-base-text-high-emphasis dark:text-black text-white border-base-text-high-emphasis"
                              : "bg-base-background text-base-text-med-emphasis border-base-border-med hover:border-base-border-focus hover:text-base-text-high-emphasis"
                          }`}
                        >
                          {selectedCrypto.isStablecoin ? "$" : ""}
                          {parseFloat(quickAmount).toLocaleString()}
                        </button>
                      ))}
                  </div>
                </div>

                {/* New Balance Preview */}
                {amount && parseFloat(amount) > 0 && (
                  <div className="bg-base-background-l2 border border-base-border-light rounded-xl p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-base-text-med-emphasis text-sm">
                        New Balance
                      </span>
                      <span className="text-base-text-high-emphasis font-mono font-bold text-lg">
                        {selectedCrypto?.isStablecoin && "$"}
                        {(
                          getCurrentBalance(selectedCrypto?.symbol || "") +
                          parseFloat(amount)
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: selectedCrypto?.isStablecoin
                            ? 2
                            : 8,
                        })}
                        {!selectedCrypto?.isStablecoin &&
                          ` ${selectedCrypto?.symbol}`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || !amount || parseFloat(amount) <= 0}
                  className="w-full bg-base-text-high-emphasis dark:text-base-background  font-bold py-4 rounded-xl hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 dark:text-black text-white"
                >
                  {isLoading ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FaPlus />
                      Add{" "}
                      {amount
                        ? `${selectedCrypto?.isStablecoin ? "$" : ""}${parseFloat(
                            amount
                          ).toLocaleString()}`
                        : "0"}{" "}
                      {selectedCrypto?.symbol}
                    </>
                  )}
                </button>

                {/* Disclaimer */}
                <p className="text-base-text-med-emphasis text-xs text-center">
                  This is demo money for paper trading. No real funds are
                  involved.
                </p>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AddCryptoModal;