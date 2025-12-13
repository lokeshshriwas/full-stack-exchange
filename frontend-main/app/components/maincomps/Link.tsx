import React from "react";

interface LinkProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

const Link: React.FC<LinkProps> = ({ children, href = "#", onClick }) => {
  return (
    <a
      href={href}
      onClick={onClick}
      className="text-sm text-neutral-400 hover:text-white transition-colors duration-200"
    >
      {children}
    </a>
  );
};

export default Link;
