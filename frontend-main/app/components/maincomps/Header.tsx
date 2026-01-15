import React from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  return (
    <div className="text-center mb-8">
      <div className="flex justify-center mb-6">
        <div className="w-12 h-12 bg-base-text-high-emphasis rounded-xl flex items-center justify-center">
          <img
            src="/favicon.ico"
            alt="logo"
            height={30}
            width={30}
            className="block dark:hidden"
          />
          <img
            src="/logo-dark.png"
            alt="logo"
            height={30}
            width={30}
            className="hidden dark:block"
          />
        </div>
      </div>
      <h1 className="text-2xl font-semibold text-base-text-high-emphasis tracking-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-base-text-med-emphasis text-sm">{subtitle}</p>
      )}
    </div>
  );
};

export default Header;
