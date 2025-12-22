import { Balance } from "@/app/utils/types";
import { BiDollarCircle } from "react-icons/bi";
import { FaCoins, FaLock, FaPlus } from "react-icons/fa";

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
    <div className="bg-base-background border border-base-border-light rounded-2xl p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-base-text-high-emphasis dark:text-black text-white flex items-center justify-center text-3xl">
            <BiDollarCircle />
          </div>
          <div>
            <h3 className="text-base-text-high-emphasis font-bold text-2xl">
              USDC
            </h3>
            <p className="text-base-text-med-emphasis text-sm">
              Trading Currency
            </p>
          </div>
        </div>
        <button
          onClick={onAddClick}
          className="flex items-center gap-2 bg-base-text-high-emphasis dark:text-black text-white font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-all"
        >
          <FaPlus />
          Add Funds
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-base-background-l2 rounded-xl p-5 border border-base-border-light">
          <p className="text-base-text-med-emphasis text-sm mb-2 flex items-center gap-2">
            <FaCoins className="text-base-text-med-emphasis" /> Available
          </p>
          <p className="text-base-text-high-emphasis font-mono font-bold text-2xl">
            $
            {available.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <div className="bg-base-background-l2 rounded-xl p-5 border border-base-border-light">
          <p className="text-base-text-med-emphasis text-sm mb-2 flex items-center gap-2">
            <FaLock className="text-base-text-med-emphasis" /> In Orders
          </p>
          <p className="text-base-text-med-emphasis font-mono font-bold text-2xl">
            $
            {locked.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <div className="bg-base-background-l2 rounded-xl p-5 border border-base-border-light">
          <p className="text-base-text-med-emphasis text-sm mb-2">
            Total Balance
          </p>
          <p className="text-base-text-high-emphasis font-mono font-bold text-2xl">
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