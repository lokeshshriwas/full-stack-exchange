import { Balance } from "@/app/utils/types";
import { BiDollarCircle } from "react-icons/bi";
import { FaCoins, FaLock, FaPlus } from "react-icons/fa";

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
    <div className="bg-base-background border border-base-border-light rounded-2xl p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-base-text-high-emphasis dark:text-black text-white flex items-center justify-center text-2xl sm:text-3xl">
            <BiDollarCircle />
          </div>

          <div>
            <h3 className="text-base-text-high-emphasis font-bold text-xl sm:text-2xl">
              USDC
            </h3>
            <p className="text-base-text-med-emphasis text-xs sm:text-sm">
              Trading Currency
            </p>
          </div>
        </div>

        <button
          onClick={onAddClick}
          className="flex items-center justify-center gap-2 bg-base-text-high-emphasis dark:text-black text-white font-bold px-4 sm:px-6 py-3 rounded-lg hover:opacity-90 transition-all w-full sm:w-auto"
        >
          <FaPlus />
          Add Funds
        </button>
      </div>

      {/* Balance Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Available */}
        <div className="bg-base-background-l2 rounded-xl p-4 sm:p-5 border border-base-border-light">
          <p className="text-base-text-med-emphasis text-xs sm:text-sm mb-2 flex items-center gap-2">
            <FaCoins /> Available
          </p>
          <p className="text-base-text-high-emphasis font-mono font-bold text-xl sm:text-2xl break-all">
            $
            {available.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        {/* Locked */}
        <div className="bg-base-background-l2 rounded-xl p-4 sm:p-5 border border-base-border-light">
          <p className="text-base-text-med-emphasis text-xs sm:text-sm mb-2 flex items-center gap-2">
            <FaLock /> In Orders
          </p>
          <p className="text-base-text-med-emphasis font-mono font-bold text-xl sm:text-2xl break-all">
            $
            {locked.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        {/* Total */}
        <div className="bg-base-background-l2 rounded-xl p-4 sm:p-5 border border-base-border-light">
          <p className="text-base-text-med-emphasis text-xs sm:text-sm mb-2">
            Total Balance
          </p>
          <p className="text-base-text-high-emphasis font-mono font-bold text-xl sm:text-2xl break-all">
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

export default USDCBalanceCard;
