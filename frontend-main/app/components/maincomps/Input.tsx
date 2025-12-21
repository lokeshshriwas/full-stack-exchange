import React, { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

interface InputProps {
  label?: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  icon?: React.ReactNode;
  name?: string;
  disabled?: boolean;
}

const Input: React.FC<InputProps> = ({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  icon,
  name,
  disabled,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-neutral-400 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 text-lg">
            {icon}
          </div>
        )}
        <input
          type={isPassword && showPassword ? "text" : type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full bg-base-background-l2 border ${
            error ? "border-red-500" : "border-base-border-med"
          } 
            rounded-lg px-4 py-3 text-base-text-high-emphasis placeholder-base-text-med-emphasis 
            focus:outline-none focus:border-base-text-high-emphasis focus:ring-1 focus:ring-base-text-high-emphasis
            transition-all duration-200 ${icon ? "pl-12" : ""} ${
            isPassword ? "pr-12" : ""
          }`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors text-lg"
          >
            {showPassword ? <FiEyeOff /> : <FiEye />}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default Input;
