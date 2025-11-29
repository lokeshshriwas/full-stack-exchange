import {
  ColorType,
  createChart as createLightWeightChart,
  CrosshairMode,
  ISeriesApi,
  UTCTimestamp,
} from "lightweight-charts";

export class ChartManager {
  private candleSeries: ISeriesApi<"Candlestick">;
  private lastUpdateTime: number = 0;
  private chart: any;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(
    ref: any,
    initialData: any[],
    layout: { background: string; color: string },
    onScroll: () => void
  ) {
    const chart = createLightWeightChart(ref, {
      autoSize: true,
      overlayPriceScales: {
        ticksVisible: true,
        borderVisible: true,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        visible: true,
        ticksVisible: true,
        entireTextOnly: true,
      },
      grid: {
        horzLines: {
          visible: false,
        },
        vertLines: {
          visible: false,
        },
      },
      layout: {
        background: {
          type: ColorType.Solid,
          color: layout.background,
        },
        textColor: "white",
      },
    });
    this.chart = chart;
    this.candleSeries = chart.addCandlestickSeries();

    this.candleSeries.setData(
      initialData.map((data) => ({
        ...data,
        time: (data.timestamp / 1000) as UTCTimestamp,
      }))
    );

    if (initialData.length > 0) {
      this.lastUpdateTime =
        initialData[initialData.length - 1].timestamp.getTime();
    }

    this.chart
      .timeScale()
      .subscribeVisibleLogicalRangeChange((newVisibleLogicalRange: any) => {
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
          if (newVisibleLogicalRange && newVisibleLogicalRange.from < 0) {
            onScroll();
          }
        }, 200);
      });
  }

  public update(updatedPrice: any) {
    if (!this.lastUpdateTime) {
      this.lastUpdateTime = new Date().getTime();
    }

    this.candleSeries.update({
      time: (this.lastUpdateTime / 1000) as UTCTimestamp,
      close: updatedPrice.close,
      low: updatedPrice.low,
      high: updatedPrice.high,
      open: updatedPrice.open,
    });

    if (updatedPrice.newCandleInitiated) {
      this.lastUpdateTime = updatedPrice.time;
    }
  }

  public updateData(data: any[]) {
    this.candleSeries.setData(
      data.map((d) => ({
        ...d,
        time: (d.timestamp / 1000) as UTCTimestamp,
      }))
    );
  }

  public destroy() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.chart.remove();
  }
}
