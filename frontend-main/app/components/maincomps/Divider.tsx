import React from "react";

interface DividerProps {
  text?: string;
}

const Divider: React.FC<DividerProps> = ({ text }) => {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-neutral-800"></div>
      </div>
      {text && (
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-neutral-950 text-neutral-600">{text}</span>
        </div>
      )}
    </div>
  );
};

export default Divider;
