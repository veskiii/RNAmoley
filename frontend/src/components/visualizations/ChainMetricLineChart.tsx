import React, { useMemo } from "react";
import { QualityScore, Residue } from "../utils/types";

type ChainMetricLineChartProps = {
  data: Residue[];
  selectedChain: string;
  selectedScore: QualityScore;
  className?: string;
};

type MetricValue = {
  value: number | null;
  displayValue: string;
};


type ChartSlot =
  | {
      kind: "residue";
      residue: Residue;
      value: number | null;
      displayValue: string;
      label: string;
      x: number;
      y: number | null;
    }
  | {
      kind: "missing-range";
      label: string;
      x: number;
      y: null;
      value: null;
    };


const chartHeight = 280;
const chartPadding = {
  top: 10,
  right: 0,
  bottom: 72,
  left: 40,
};
const itemWidth = 32;

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) {
    return "";
  }

  if (Number.isInteger(value)) {
    return `${value}`;
  }

  return value.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
};

const getNiceTickStep = (maxValue: number) => {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return 1;
  }

  const targetTicks = 6;
  const roughStep = maxValue / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalizedStep = roughStep / magnitude;

  let niceNormalizedStep = 1;
  if (normalizedStep <= 1) {
    niceNormalizedStep = 1;
  } else if (normalizedStep <= 2) {
    niceNormalizedStep = 2;
  } else if (normalizedStep <= 5) {
    niceNormalizedStep = 5;
  } else {
    niceNormalizedStep = 10;
  }

  return niceNormalizedStep * magnitude;
};

const getMetricLabel = (selectedScore: QualityScore) => {
  switch (selectedScore) {
    case QualityScore.CLASH_SCORE:
      return "Clash score";
    case QualityScore.BAD_ANGLES:
      return "Bad angles";
    case QualityScore.BAD_BONDS:
      return "Bad bonds";
    case QualityScore.SUITENESS:
      return "Suiteness";
    case QualityScore.SUGAR_PUCKER_OUT:
      return "Sugar pucker outlier";
    default:
      return selectedScore;
  }
};

const getMetricValue = (residue: Residue, selectedScore: QualityScore): MetricValue => {
  if (selectedScore === QualityScore.CLASH_SCORE) {
    const parsedValue = parseFloat(residue.metrics?.clashscore ?? "");
    return Number.isFinite(parsedValue)
      ? { value: parsedValue, displayValue: formatNumber(parsedValue) }
      : { value: null, displayValue: "-" };
  }

  if (selectedScore === QualityScore.BAD_ANGLES) {
    const parsedValue = parseFloat(residue.metrics?.pct_badangles ?? "");
    return Number.isFinite(parsedValue)
      ? { value: parsedValue, displayValue: formatNumber(parsedValue) }
      : { value: null, displayValue: "-" };
  }

  if (selectedScore === QualityScore.BAD_BONDS) {
    const parsedValue = parseFloat(residue.metrics?.pct_badbonds ?? "");
    return Number.isFinite(parsedValue)
      ? { value: parsedValue, displayValue: formatNumber(parsedValue) }
      : { value: null, displayValue: "-" };
  }

  if (selectedScore === QualityScore.SUITENESS) {
    const parsedValue = parseFloat(residue.residueMetrics?.suiteness ?? "");
    return Number.isFinite(parsedValue)
      ? { value: parsedValue, displayValue: formatNumber(parsedValue) }
      : { value: null, displayValue: "-" };
  }

  if (selectedScore === QualityScore.SUGAR_PUCKER_OUT) {
    const hasOutlier = Boolean(residue.residueMetrics?.pucker_outlier_type);
    return {
      value: hasOutlier ? 1 : 0,
      displayValue: hasOutlier ? residue.residueMetrics?.pucker_outlier_type || "1" : "0",
    };
  }

  return { value: null, displayValue: "-" };
};

const buildSegmentPaths = (
  points: Array<{ x: number; y: number | null; value: number | null }>
) => {
  const segments: string[] = [];
  let currentPath = "";

  points.forEach((point) => {
    if (point.value === null) {
      if (currentPath) {
        segments.push(currentPath);
        currentPath = "";
      }
      return;
    }

    if (!currentPath) {
      currentPath = `M ${point.x} ${point.y}`;
      return;
    }

    currentPath += ` L ${point.x} ${point.y}`;
  });

  if (currentPath) {
    segments.push(currentPath);
  }

  return segments;
};

const ChainMetricLineChart: React.FC<ChainMetricLineChartProps> = ({
  data,
  selectedChain,
  selectedScore,
  className,
}) => {
  const chartData = useMemo(() => {
    const chainResidues = data
      .filter((residue) => residue.chainID === selectedChain)
      .slice()
      .sort((left, right) => left.original_index - right.original_index);

    const residuePoints = chainResidues.map((residue) => {
      const metric = getMetricValue(residue, selectedScore);
      const isSelected = residue.selected !== false;

      return {
        residue,
        value: isSelected ? metric.value : null,
        displayValue: isSelected ? metric.displayValue : "-",
        label: `${residue.original_index}\n${residue.structure || "-"}\n${residue.base || "-"}`,
      };
    });

    const numericValues = residuePoints
      .map((point) => point.value)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    const hasNumericValues = numericValues.length > 0;
    const maxValue = hasNumericValues ? Math.max(...numericValues) : 1;
    const tickStep = getNiceTickStep(maxValue);
    const tickCount = Math.max(1, Math.ceil(maxValue / tickStep));
    const yMin = 0;
    const yMax = tickStep * tickCount;

    const slots: Array<{
      kind: "residue" | "missing-range";
      residue?: Residue;
      value: number | null;
      displayValue?: string;
      label: string;
    }> = [];

    let cursor = 0;
    while (cursor < residuePoints.length) {
      const point = residuePoints[cursor];

      if (point.value !== null) {
        slots.push({
          kind: "residue",
          residue: point.residue,
          value: point.value,
          displayValue: point.displayValue,
          label: `${point.residue.original_index}`,
        });
        cursor += 1;
        continue;
      }

      const start = cursor;
      while (cursor + 1 < residuePoints.length && residuePoints[cursor + 1].value === null) {
        cursor += 1;
      }

      const end = cursor;
      const startIndex = residuePoints[start].residue.original_index;
      const endIndex = residuePoints[end].residue.original_index;

      slots.push({
        kind: "missing-range",
        value: null,
        label: startIndex === endIndex ? `${startIndex}` : `${startIndex}-${endIndex}`,
      });

      cursor += 1;
    }

    const width = chartPadding.left + chartPadding.right + Math.max(1, slots.length) * itemWidth;
    const innerWidth = Math.max(1, width - chartPadding.left - chartPadding.right);
    const innerHeight = Math.max(1, chartHeight - chartPadding.top - chartPadding.bottom);

    const xForIndex = (index: number) => chartPadding.left + index * itemWidth + itemWidth / 2;

    const yForValue = (value: number) => {
      if (yMax === yMin) {
        return chartPadding.top + innerHeight / 2;
      }

      return (
        chartPadding.top +
        innerHeight - ((value - yMin) / (yMax - yMin)) * innerHeight
      );
    };

    const renderSlots: ChartSlot[] = slots.map((slot, index) => {
      const x = xForIndex(index);

      if (slot.kind === "missing-range") {
        return {
          kind: "missing-range",
          label: slot.label,
          x,
          y: null,
          value: null,
        };
      }

      return {
        kind: "residue",
        residue: slot.residue as Residue,
        value: slot.value,
        displayValue: slot.displayValue || "-",
        label: slot.label,
        x,
        y: slot.value === null ? null : yForValue(slot.value),
      };
    });

    return {
      chainResidues,
      points: renderSlots,
      hasNumericValues,
      yMin,
      yMax,
      width,
      innerWidth,
      innerHeight,
      xForIndex,
      yForValue,
      segments: buildSegmentPaths(renderSlots),
    };
  }, [data, selectedChain, selectedScore]);

  if (!selectedChain) {
    return (
      <div className={className}>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500 shadow-sm">
          Select a chain to display the line chart.
        </div>
      </div>
    );
  }

  if (chartData.chainResidues.length === 0) {
    return (
      <div className={className}>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500 shadow-sm">
          No residues found for the selected chain.
        </div>
      </div>
    );
  }

  const yTicks = chartData.hasNumericValues
    ? Array.from({ length: Math.round(chartData.yMax / getNiceTickStep(chartData.yMax)) + 1 }, (_, index) => {
        const tickValue = chartData.yMin + index * getNiceTickStep(chartData.yMax);
        return tickValue;
      })
    : [];

  return (
    <div className={className}>
      {/* <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"> */}
        <div className="flex flex-wrap items-center text-center justify-center gap-2">
          {getMetricLabel(selectedScore)}
        </div>

        <div className="overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
          <svg
            width={chartData.width}
            height={chartHeight}
            viewBox={`0 0 ${chartData.width} ${chartHeight}`}
            role="img"
            aria-label={`Line chart for ${getMetricLabel(selectedScore)} in chain ${selectedChain}`}
            className="block"
          >
            <rect
              x={chartPadding.left}
              y={chartPadding.top}
              width={chartData.innerWidth}
              height={chartData.innerHeight}
              rx={12}
              className="fill-slate-50"
            />

            {chartData.hasNumericValues && (
              <>
                {yTicks.map((tickValue, index) => {
                  const y = chartData.yForValue(tickValue);

                  return (
                    <g key={`y-tick-${index}`}>
                      <line
                        x1={chartPadding.left}
                        x2={chartData.width - chartPadding.right}
                        y1={y}
                        y2={y}
                        stroke="#e5e7eb"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={chartPadding.left - 10}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-gray-500"
                        style={{ fontSize: 11 }}
                      >
                        {formatNumber(tickValue)}
                      </text>
                    </g>
                  );
                })}

                <line
                  x1={chartPadding.left}
                  x2={chartPadding.left}
                  y1={chartPadding.top}
                  y2={chartPadding.top + chartData.innerHeight}
                  stroke="#9ca3af"
                />
                <line
                  x1={chartPadding.left}
                  x2={chartPadding.left + chartData.innerWidth}
                  y1={chartPadding.top + chartData.innerHeight}
                  y2={chartPadding.top + chartData.innerHeight}
                  stroke="#9ca3af"
                />
              </>
            )}

            {chartData.segments.map((segment, index) => (
              <path
                key={`segment-${index}`}
                d={segment}
                fill="none"
                stroke="#0f766e"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {chartData.points.map((point, index) => {
              if (point.kind !== "residue" || point.y === null || point.value === null) {
                return null;
              }

              return (
                <g key={`${point.residue.original_index}-${index}`}>
                  <line
                    x1={point.x}
                    x2={point.x}
                    y1={chartPadding.top + chartData.innerHeight}
                    y2={chartPadding.top + chartData.innerHeight + 8}
                    stroke="#9ca3af"
                  />
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={point.value === 0 ? 3.5 : 4.5}
                    fill="#0f766e"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  >
                    <title>
                      {`Residue ${point.residue.original_index} | ${point.residue.base} | ${point.residue.structure || "-"} | ${point.displayValue}`}
                    </title>
                  </circle>
                </g>
              );
            })}

            {chartData.points.map((item, index) => {
              const labelX = item.x;
              const firstLineY = chartPadding.top + chartData.innerHeight + 24;

              return (
                <g key={`label-${item.label}-${index}`}>
                  <text
                    x={labelX}
                    y={firstLineY}
                    textAnchor="middle"
                    className="fill-gray-900"
                    style={{ fontSize: 11, fontWeight: 600 }}
                  >
                    {item.label}
                  </text>
                  {item.kind === "residue" && (
                    <>
                      <text
                        x={labelX}
                        y={firstLineY + 18}
                        textAnchor="middle"
                        className="fill-gray-600"
                        style={{ fontSize: 11 }}
                      >
                        {item.residue.structure || "-"}
                      </text>
                      <text
                        x={labelX}
                        y={firstLineY + 36}
                        textAnchor="middle"
                        className="fill-gray-700"
                        style={{ fontSize: 11, fontWeight: 600 }}
                      >
                        {item.residue.base || "-"}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        {!chartData.hasNumericValues && (
          <div className="mt-2 text-xs text-gray-500">
            No numeric metric values for this chain; grouped residue labels are still shown.
          </div>
        )}
    </div>
  );
};

export default ChainMetricLineChart;