"use client";
import React from "react";
import dynamic from "next/dynamic";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type LineChartProps = {
  close: string;
  end: string;
};

// Error boundary component to catch ApexCharts errors
class ChartErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Chart error caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[50px] w-[80px] flex items-center justify-center text-xs text-gray-400">
          Chart error
        </div>
      );
    }
    return this.props.children;
  }
}

const LineChart = ({ data }: { data: LineChartProps[] }) => {
  const [color, setColor] = React.useState("#FF0000");
  // Use ref to store last valid data to prevent chart crashes during refetch
  const lastValidDataRef = React.useRef<number[]>([]);
  const [chartKey, setChartKey] = React.useState(0);

  // Memoize the processed data to prevent unnecessary recalculations
  const processedData = React.useMemo(() => {
    // Enhanced validation
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.log(
        "LineChart: Invalid or empty data array, using last valid data",
      );
      return lastValidDataRef.current;
    }

    // Filter out invalid data and convert to numbers
    const validData = data
      .map((d, index) => {
        if (
          !d ||
          typeof d.close === "undefined" ||
          d.close === null ||
          d.close === ""
        ) {
          console.warn(`LineChart: Invalid data point at index ${index}:`, d);
          return null;
        }
        const num = Number(d.close);
        if (!isFinite(num) || isNaN(num)) {
          console.warn(
            `LineChart: Non-finite number at index ${index}: ${d.close} -> ${num}`,
          );
          return null;
        }
        return num;
      })
      .filter((num): num is number => num !== null);

    // Require minimum data points for a valid chart
    if (validData.length < 2) {
      console.log(
        `LineChart: Insufficient valid data points (${validData.length}), using last valid data`,
      );
      return lastValidDataRef.current;
    }

    // Only update if we have valid data
    if (validData.length > 0) {
      console.log(`LineChart: Processed ${validData.length} valid data points`);
      lastValidDataRef.current = validData;
      // Force chart remount on significant data changes to prevent stale state
      setChartKey((prev) => prev + 1);
      return validData;
    }

    // Return last valid data if current data is invalid
    return lastValidDataRef.current;
  }, [data]);

  // Update color based on data trend
  React.useEffect(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return;

    const firstPrice = Number(data[0]?.close);
    const lastPrice = Number(data[data.length - 1]?.close);

    if (isFinite(firstPrice) && isFinite(lastPrice)) {
      setColor(firstPrice > lastPrice ? "#FF0000" : "#00FF00");
    }
  }, [data]);

  // Memoize chart options to prevent recreation on every render
  const options = React.useMemo(
    () => ({
      chart: {
        type: "line" as const,
        toolbar: { show: false },
        zoom: { enabled: false },
        sparkline: { enabled: true },
        animations: {
          enabled: true,
          easing: "easeinout",
          speed: 400,
          animateGradually: {
            enabled: true,
            delay: 150,
          },
          dynamicAnimation: {
            enabled: true,
            speed: 350,
          },
        },
      },
      stroke: {
        curve: "smooth" as const,
        width: 2,
      },
      markers: {
        size: 0,
      },
      tooltip: {
        enabled: false,
      },
      colors: [color],
    }),
    [color],
  );

  // Memoize series to prevent recreation
  const series = React.useMemo(() => {
    // Double-check data validity before creating series
    if (!processedData || processedData.length < 2) {
      return [{ data: [] }];
    }
    return [{ data: processedData }];
  }, [processedData]);

  // Don't render chart if we have no valid data at all
  if (!processedData || processedData.length < 2) {
    return (
      <div className="h-[50px] w-[80px] flex items-center justify-center text-xs text-gray-400">
        No data
      </div>
    );
  }

  return (
    <ChartErrorBoundary>
      <div>
        <Chart
          key={chartKey} // Force remount on data changes
          options={options}
          series={series}
          type="line"
          height={50}
          width={80}
        />
      </div>
    </ChartErrorBoundary>
  );
};

export default LineChart;
