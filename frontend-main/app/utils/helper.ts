import cname from "../../public/assets/cname.json";

// types 


interface CryptoEntry {
  symbol: string;
  name: string;
}


// functions 

export const formatNumber = (num: any): string => {
  const value = Number(num);
  if (isNaN(value)) return "-";

  if (value < 1000) return value.toFixed(2);
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)}K`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  return `${(value / 1_000_000_000).toFixed(1)}B`;
};

export const getFullName = (symbol: string): string | null => {
  const entry = (cname as CryptoEntry[]).find(
    (x) => x.symbol.toUpperCase() === trimString(symbol)?.toUpperCase()
  );
  return entry ? entry.name : null;
};

export const trimString = (symbol : string):  string | null => {
    return symbol.split("_")[0].toLowerCase() || null;
}

export const  getStartAndEndTime = (daysAgo: number = 7, hoursAgo: number = 1) => {
  const endTime = Math.floor(Date.now() / 1000);
  const secondsAgo = daysAgo * 24 * 60 * 60 + hoursAgo * 60 * 60;
  const startTime = endTime - secondsAgo;
  return { startTime, endTime };
}


export const getTopGainers = (tableData : any)=>{
  const top5gainers =  tableData.sort((a: any, b: any) => b.priceChangePercent - a.priceChangePercent);
  return top5gainers.slice(0, 5);
}

export const exploreNew = (tableData : any)=> {
  // pick randome 5 cryptos
  const exploreNew = tableData.sort(() => Math.random() - 0.5);
  return exploreNew.slice(0, 5);
}

export const mostPopular = (tableData : any)=>{
  const mostPopular =  tableData.sort((a: any, b: any) => b.volume - a.volume);
  return mostPopular.slice(0, 5);
}