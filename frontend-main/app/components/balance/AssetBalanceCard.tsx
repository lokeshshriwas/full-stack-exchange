import { getAssetIcon } from "@/app/balance/page";
import { Balance } from "@/app/utils/types";
import { FaPlus } from "react-icons/fa";

// Other Asset Balance Card
const AssetBalanceCard = ({
  balance,
  onAddClick,
}: {
  balance: Balance;
  onAddClick: (symbol: string) => void;
}) => {
  const available = parseFloat(balance.available);
  const locked = parseFloat(balance.locked);
  const total = available + locked;

  return (
    <div className="bg-base-background border border-base-border-light rounded-xl p-5 hover:border-base-border-med transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-base-background-l2 border border-base-border-light flex items-center justify-center text-xl text-base-text-high-emphasis">
            {getAssetIcon(balance.symbol)}
          </div>
          <div>
            <h3 className="text-base-text-high-emphasis font-bold">
              {balance.symbol}
            </h3>
            <p className="text-base-text-med-emphasis text-xs">Spot Balance</p>
          </div>
        </div>
        <button
          onClick={() => onAddClick(balance.symbol)}
          className="p-2 hover:bg-base-background-l2 rounded-lg transition-all text-base-text-med-emphasis hover:text-base-text-high-emphasis"
        >
          <FaPlus />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-base-text-med-emphasis text-sm">Available</span>
          <span className="text-base-text-high-emphasis font-mono">
            {available.toLocaleString(undefined, {
              minimumFractionDigits: 4,
              maximumFractionDigits: 8,
            })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-base-text-med-emphasis text-sm">Locked</span>
          <span className="text-base-text-med-emphasis font-mono">
            {locked.toLocaleString(undefined, {
              minimumFractionDigits: 4,
              maximumFractionDigits: 8,
            })}
          </span>
        </div>
        <div className="border-t border-base-border-light pt-2 mt-2">
          <div className="flex justify-between">
            <span className="text-base-text-med-emphasis text-sm">Total</span>
            <span className="text-base-text-high-emphasis font-mono font-semibold">
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

export default AssetBalanceCard;