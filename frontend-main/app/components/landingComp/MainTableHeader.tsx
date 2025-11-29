"use client";

import { useState } from "react";

const MainTableHeader = () => {
  const [activeTab, setActiveTab] = useState("spot");
  return (
    <div className="flex flex-row">
      <div className="items-center justify-center flex-row flex gap-2">
        <div
          className={`flex justify-center flex-col cursor-pointer rounded-lg py-1 font-medium outline-hidden hover:opacity-90 text-high-emphasis px-3 h-8 text-sm ${
            activeTab == "spot" && "bg-[#3c3b3b]"
          } `}
          onClick={() => setActiveTab("spot")}
        >
          Spot
        </div>
        <div className={`flex justify-center flex-col cursor-pointer rounded-lg py-1 font-medium outline-hidden hover:opacity-90 text-high-emphasis px-3 h-8 text-sm ${
            activeTab == "futures" && "bg-[#3c3b3b]"
          } `}
        onClick={() => setActiveTab("futures")}
        >
          Futures
        </div>
        <div className={`flex justify-center flex-col cursor-pointer rounded-lg py-1 font-medium outline-hidden hover:opacity-90 text-high-emphasis px-3 h-8 text-sm ${
            activeTab == "lend" && "bg-[#3c3b3b]"
          } `}
        onClick={() => setActiveTab("lend")}
        >
          Lend
        </div>
      </div>
    </div>
  );
};

export default MainTableHeader;
