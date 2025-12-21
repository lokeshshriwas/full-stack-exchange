import React from "react";
import { FiCheck } from "react-icons/fi";

interface CheckboxProps {
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}

const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checked,
  onChange,
  error,
}) => {
  return (
    <div>
      <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative mt-0.5">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only"
          />
          <div
            className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center ${
              checked
                ? "bg-base-text-high-emphasis border-base-text-high-emphasis"
                : error
                ? "border-red-500"
                : "border-base-border-med group-hover:border-base-text-med-emphasis"
            }`}
          >
            {checked && (
              <FiCheck className="dark:text-black text-white text-sm stroke-[3]" />
            )}
          </div>
        </div>
        <span className="text-sm text-base-text-med-emphasis group-hover:text-base-text-high-emphasis transition-colors">
          {label}
        </span>
      </label>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default Checkbox;
