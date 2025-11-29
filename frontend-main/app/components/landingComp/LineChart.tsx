'use client'
import React from "react";
import dynamic from "next/dynamic";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type LineChartProps = {
  close: string;
  end: string;
};

const LineChart = ({ data }: { data: LineChartProps[] }) => {
  const [color, setColor] = React.useState("#FF0000");
  const [seriesData, setSeriesData] = React.useState<number[]>([]);

  const defineSeriesData = (data: LineChartProps[]) => {
    setSeriesData(data.map((d) => Number(d.close)));
  };

  const defineColor = (data: LineChartProps[]) => {
    if (!data.length) return;
    if (Number(data[0].close) > Number(data[data.length - 1].close)) {
      setColor("#FF0000");
    } else {
      setColor("#00FF00");
    }
  };

  React.useEffect(() => {
   if(data?.length){
       defineColor(data);
       defineSeriesData(data);
   }
  }, [data]);

  const options = {
    chart: {
      type: "line",
      toolbar: { show: false },
      zoom: { enabled: false },
      sparkline: { enabled: true }, // hides grid/axes
    },
    stroke: {
      curve: "smooth",
      width: 2,
    },
    markers: {
      size: 0,
    },
    tooltip: {
      enabled: false,
    },
    colors: [color],
  };

  const series = [
    {
      data: seriesData,
    },
  ];

  return (
    <div>
      <Chart options={options} series={series} type="line" height={50} width={80} />
    </div>
  );
};

export default LineChart;
