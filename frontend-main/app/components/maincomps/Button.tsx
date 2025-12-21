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
    "font-medium rounded-lg px-6 py-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-background";

  const variants = {
    primary:
      "bg-base-background-l2 text-neutral-900 hover:bg-gray-300 dark:bg-base-background-l2 dark:text-white dark:border dark:border-base-border-light/10 dark:hover:bg-base-background-l3 focus:ring-base-border-med disabled:opacity-50 disabled:cursor-not-allowed",
    secondary:
      "bg-base-background-l2 text-base-text-high-emphasis border border-base-border-light hover:border-base-border-med focus:ring-base-border-med",
    ghost:
      "bg-transparent text-base-text-med-emphasis hover:text-base-text-high-emphasis hover:bg-base-background-l2 focus:ring-base-border-med",
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
