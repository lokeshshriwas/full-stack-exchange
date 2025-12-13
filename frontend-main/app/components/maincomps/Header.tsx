import React from "react";
import { HiCube } from "react-icons/hi2";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  return (
    <div className="text-center mb-8">
      <div className="flex justify-center mb-6">
        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
          <HiCube className="text-2xl text-neutral-900" />
        </div>
      </div>
      <h1 className="text-2xl font-semibold text-white tracking-tight">
        {title}
      </h1>
      {subtitle && <p className="mt-2 text-neutral-500 text-sm">{subtitle}</p>}
    </div>
  );
};

export default Header;
