import React from "react";

const DepthHeader = ({
  onClick,
  activeDepth,
}: {
  onClick: (depth: string) => void;
  activeDepth: string;
}) => {
  return (
    <div className="px-4 py-4">
      <div className="items-center justify-start flex-row flex gap-2 gap-x-2">
        <div
          className={`flex justify-center flex-col cursor-pointer rounded-lg py-1 font-medium outline-hidden hover:opacity-90 text-high-emphasis px-3 h-8 text-sm ${
            activeDepth == "book" && "bg-base-background-l2"
          }`}
          onClick={() => onClick("book")}
        >
          Book
        </div>
        <div
          className={`flex justify-center flex-col cursor-pointer rounded-lg py-1 font-medium outline-hidden hover:opacity-90 text-high-emphasis px-3 h-8 text-sm ${
            activeDepth == "trade" && "bg-base-background-l2"
          }`}
          onClick={() => onClick("trade")}
        >
          Trades
        </div>
      </div>
    </div>
  );
};

export default DepthHeader;
