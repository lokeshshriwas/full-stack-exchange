import React from "react";

interface SocialButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

const SocialButton: React.FC<SocialButtonProps> = ({
  icon,
  label,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300 hover:bg-neutral-800 hover:border-neutral-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-neutral-700"
    >
      <span className="text-xl">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
};

export default SocialButton;
