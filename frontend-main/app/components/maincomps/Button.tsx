import React from "react";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "ghost";
  fullWidth?: boolean;
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  type = "button",
  variant = "primary",
  fullWidth = false,
  disabled = false,
}) => {
  const baseStyles =
    "font-medium rounded-lg px-6 py-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900";

  const variants = {
    primary:
      "bg-white text-neutral-900 hover:bg-neutral-200 focus:ring-white disabled:bg-neutral-600 disabled:text-neutral-400",
    secondary:
      "bg-neutral-800 text-white border border-neutral-700 hover:bg-neutral-700 focus:ring-neutral-500",
    ghost:
      "bg-transparent text-neutral-400 hover:text-white hover:bg-neutral-800 focus:ring-neutral-500",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${
        fullWidth ? "w-full" : ""
      }`}
    >
      {children}
    </button>
  );
};

export default Button;
