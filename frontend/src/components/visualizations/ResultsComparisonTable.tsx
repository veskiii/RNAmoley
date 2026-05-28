import React, { useMemo } from "react";
import { SummaryJob, Residue } from "../utils/types";
import { formatNumberForDisplay } from "../utils/displayUniform";

type ResultsComparisonTableProps = {
  referenceData?: SummaryJob;
  comparisonData?: SummaryJob;
  referenceLabel?: string;
  comparisonLabel?: string;
  simulationParameters?: Array<{
    label: string | null;
    value: string | number | null | undefined;
  }>;
  className?: string;
  selectedFragments?: Record<string, string>;
  selectedModel: number;
};

type MetricDefinition = {
  key: string;
  label: string;
  higherIsBetter: boolean;
  extract: (residue: Residue) => number | null;
};

type ChangeStats = {
  largest: number | null;
  smallest: number | null;
  mean: number | null;
  median: number | null;
};

type MetricSummary = {
  key: string;
  label: string;
  comparedCount: number;
  improvedCount: number;
  worsenedCount: number;
  unchangedCount: number;
  meanSignedChange: number | null;
  improvementRatio: number | null;
  improvementStats: ChangeStats;
  worseningStats: ChangeStats;
};

type AggregateMetricDefinition = {
  key: string;
  label: string;
  displayValue?: (metrics: unknown) => string;
};

type AggregateMetricRow = {
  key: string;
  label: string;
  referenceValue: number | null;
  comparisonValue: number | null;
  deltaValue: number | null;
  referenceDisplay?: string;
  comparisonDisplay?: string;
};

type MetricCell = {
  metricKey: string;
  label: string;
  value: string;
};

type ImpactRow = {
  label: string;
  cells: MetricCell[];
};

type DetailSection = {
  title: string;
  rows: Array<{
    label: string;
    values: Array<number | null>;
  }>;
};

const EPSILON = 1e-9;

const analyzedRegionMetricDefinitions: AggregateMetricDefinition[] = [
  { key: "clashscore", label: "Clash score" },
  {
    key: "pct_badbonds",
    label: "Bad bonds / all bonds (%)",
    displayValue: (metrics) => formatCountAndPercent(metrics, "numbadbonds", "numbonds", "pct_badbonds"),
  },
  { key: "pct_resbadbonds", label: "Residues with bad bonds (%)" },
  {
    key: "pct_badangles",
    label: "Bad angles / all angles (%)",
    displayValue: (metrics) => formatCountAndPercent(metrics, "numbadangles", "numangles", "pct_badangles"),
  },
  { key: "pct_resbadangles", label: "Residues with bad angles (%)" },
  { key: "numSuiteOutliers", label: "Suite outliers" },
];

const metricDefinitions: MetricDefinition[] = [
  {
    key: "clashscore",
    label: "Clash score",
    higherIsBetter: false,
    extract: (residue) => parseNumericValue(residue.metrics?.clashscore),
  },
  {
    key: "pct_badbonds",
    label: "Bad bonds",
    higherIsBetter: false,
    extract: (residue) => parseNumericValue(residue.metrics?.pct_badbonds),
  },
  {
    key: "pct_badangles",
    label: "Bad angles",
    higherIsBetter: false,
    extract: (residue) => parseNumericValue(residue.metrics?.pct_badangles),
  },
  {
    key: "suiteness",
    label: "Suiteness",
    higherIsBetter: true,
    extract: (residue) => parseNumericValue(residue.residueMetrics?.suiteness),
  },
  {
    key: "suite_outliers",
    label: "Suite outliers (suiteness = 0.00)",
    higherIsBetter: false,
    extract: (residue) => (hasSuiteOutlier(residue) ? 1 : 0),
  },
  {
    key: "pucker_outlier_type",
    label: "Sugar pucker outlier",
    higherIsBetter: false,
    extract: (residue) => (hasPuckerOutlier(residue) ? 1 : 0),
  },
];

const impactMetricKeys = [
  "clashscore",
  "pct_badbonds",
  "pct_badangles",
  "suiteness",
  "suite_outliers",
  "pucker_outlier_type",
] as const;

const detailedMetricKeys = ["clashscore", "pct_badbonds", "pct_badangles", "suiteness"] as const;

const parseNumericValue = (value?: string | null) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsedValue = Number.parseFloat(String(value));
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const parseMetricNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsedValue = Number.parseFloat(String(value));
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const formatCountAndPercent = (metrics: unknown, countKey: string, totalKey: string, percentKey: string) => {
  const record = (metrics || {}) as Record<string, unknown>;
  const count = parseMetricNumber(record[countKey]);
  const total = parseMetricNumber(record[totalKey]);
  const percent = parseMetricNumber(record[percentKey]);

  if (count === null && total === null && percent === null) {
    return "—";
  }

  const resolvedTotal =
    total !== null
      ? total
      : count !== null && percent !== null && Math.abs(percent) > EPSILON
        ? (count * 100) / percent
        : null;

  const countText = count !== null ? formatNumberWithOptionalDecimals(count) : "—";
  const totalText = resolvedTotal !== null ? formatNumberWithOptionalDecimals(resolvedTotal) : "—";
  const percentText = percent !== null ? formatNumberWithOptionalDecimals(percent) : "—";

  return `${countText} / ${totalText} (${percentText}%)`;
};

const buildAggregateMetricRows = (
  referenceMetrics: unknown,
  comparisonMetrics: unknown,
): AggregateMetricRow[] => {
  const referenceRecord = (referenceMetrics || {}) as Record<string, unknown>;
  const comparisonRecord = (comparisonMetrics || {}) as Record<string, unknown>;

  return analyzedRegionMetricDefinitions.map((metric) => {
    const referenceValue = parseMetricNumber(referenceRecord[metric.key]);
    const comparisonValue = parseMetricNumber(comparisonRecord[metric.key]);
    const deltaValue =
      referenceValue !== null && comparisonValue !== null ? comparisonValue - referenceValue : null;

    return {
      key: metric.key,
      label: metric.label,
      referenceValue,
      comparisonValue,
      deltaValue,
      referenceDisplay: metric.displayValue?.(referenceRecord),
      comparisonDisplay: metric.displayValue?.(comparisonRecord),
    };
  });
};

const buildImpactRows = (summaries: MetricSummary[]): ImpactRow[] => {
  const summaryMap = new Map(summaries.map((summary) => [summary.key, summary] as const));

  return [
    {
      label: "Improved (count / %)",
      cells: impactMetricKeys.map((metricKey) => {
        const summary = summaryMap.get(metricKey);
        return {
          metricKey,
          label: summary?.label ?? metricKey,
          value: summary ? formatCountShare(summary.improvedCount, summary.comparedCount) : "—",
        };
      }),
    },
    {
      label: "Deteriorated (count / %)",
      cells: impactMetricKeys.map((metricKey) => {
        const summary = summaryMap.get(metricKey);
        return {
          metricKey,
          label: summary?.label ?? metricKey,
          value: summary ? formatCountShare(summary.worsenedCount, summary.comparedCount) : "—",
        };
      }),
    },
    {
      label: "Unchanged (count / %)",
      cells: impactMetricKeys.map((metricKey) => {
        const summary = summaryMap.get(metricKey);
        return {
          metricKey,
          label: summary?.label ?? metricKey,
          value: summary ? formatCountShare(summary.unchangedCount, summary.comparedCount) : "—",
        };
      }),
    },
    {
      label: "Mean change",
      cells: impactMetricKeys.map((metricKey) => {
        const summary = summaryMap.get(metricKey);
        return {
          metricKey,
          label: summary?.label ?? metricKey,
          value: summary ? formatDelta(summary.meanSignedChange) : "—",
        };
      }),
    },
  ];
};

const buildDetailedSections = (summaries: MetricSummary[]): DetailSection[] => {
  const summaryMap = new Map(summaries.map((summary) => [summary.key, summary] as const));

  const getValue = (metricKey: (typeof detailedMetricKeys)[number], getter: (summary: MetricSummary) => number | null) => {
    const summary = summaryMap.get(metricKey);
    return summary ? getter(summary) : null;
  };

  return [
    {
      title: "Improvement:",
      rows: [
        {
          label: "Largest",
          values: detailedMetricKeys.map((metricKey) => getValue(metricKey, (summary) => summary.improvementStats.largest)),
        },
        {
          label: "Least",
          values: detailedMetricKeys.map((metricKey) => getValue(metricKey, (summary) => summary.improvementStats.smallest)),
        },
        {
          label: "Mean",
          values: detailedMetricKeys.map((metricKey) => getValue(metricKey, (summary) => summary.improvementStats.mean)),
        },
        {
          label: "Median",
          values: detailedMetricKeys.map((metricKey) => getValue(metricKey, (summary) => summary.improvementStats.median)),
        },
      ],
    },
    {
      title: "Deterioration:",
      rows: [
        {
          label: "Largest",
          values: detailedMetricKeys.map((metricKey) => getValue(metricKey, (summary) => summary.worseningStats.largest)),
        },
        {
          label: "Least",
          values: detailedMetricKeys.map((metricKey) => getValue(metricKey, (summary) => summary.worseningStats.smallest)),
        },
        {
          label: "Mean",
          values: detailedMetricKeys.map((metricKey) => getValue(metricKey, (summary) => summary.worseningStats.mean)),
        },
        {
          label: "Median",
          values: detailedMetricKeys.map((metricKey) => getValue(metricKey, (summary) => summary.worseningStats.median)),
        },
      ],
    },
  ];
};

const hasPuckerOutlier = (residue: Residue) => {
  return Boolean((residue.residueMetrics?.pucker_outlier_type || "").toString().trim());
};

const hasSuiteOutlier = (residue: Residue) => {
  const suiteness = parseNumericValue(residue.residueMetrics?.suiteness);
  return suiteness !== null && Math.abs(suiteness) <= EPSILON;
};

const getResidueKey = (residue: Residue) => `${residue.chainID}-${String(residue.original_index)}`;

const buildResidueMap = (residues: Residue[]) => {
  const residueMap = new Map<string, Residue>();

  residues.forEach((residue) => {
    residueMap.set(getResidueKey(residue), residue);
  });

  return residueMap;
};

const average = (values: number[]) => {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const median = (values: number[]) => {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middleIndex];
  }

  return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2;
};

const formatNumberWithOptionalDecimals = (value: number) => {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
};

const formatDelta = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }

  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatNumberWithOptionalDecimals(Math.abs(value))}`;
};

const formatValue = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }

  return formatNumberWithOptionalDecimals(value);
};

const formatCountShare = (count: number, total: number) => {
  if (total === 0) {
    return "—";
  }

  const percentage = (count / total) * 100;
  return `${count} / ${formatNumberWithOptionalDecimals(percentage)}%`;
};

const formatSimulationParameterValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? formatNumberForDisplay(numericValue.toString()) : String(value);
};

const summarizeMetric = (
  metric: MetricDefinition,
  referenceResidues: Residue[],
  comparisonResidues: Residue[],
): MetricSummary => {
  const comparisonMap = buildResidueMap(comparisonResidues);
  const changes: number[] = [];

  referenceResidues.forEach((referenceResidue) => {
    if (!referenceResidue.selected) {
      return;
    }

    const comparisonResidue = comparisonMap.get(getResidueKey(referenceResidue));
    if (!comparisonResidue) {
      return;
    }

    if (!comparisonResidue.selected) {
      return;
    }

    const before = metric.extract(referenceResidue);
    const after = metric.extract(comparisonResidue);
    if (before === null || after === null) {
      return;
    }

    changes.push(after - before);
  });

  const improvedChanges = changes.filter((change) =>
    metric.higherIsBetter ? change > EPSILON : change < -EPSILON,
  );
  const worsenedChanges = changes.filter((change) =>
    metric.higherIsBetter ? change < -EPSILON : change > EPSILON,
  );
  const unchangedCount = changes.length - improvedChanges.length - worsenedChanges.length;

  const orderedImprovements = metric.higherIsBetter
    ? [...improvedChanges].sort((left, right) => right - left)
    : [...improvedChanges].sort((left, right) => left - right);

  const orderedWorsenings = metric.higherIsBetter
    ? [...worsenedChanges].sort((left, right) => left - right)
    : [...worsenedChanges].sort((left, right) => right - left);

  return {
    key: metric.key,
    label: metric.label,
    comparedCount: changes.length,
    improvedCount: improvedChanges.length,
    worsenedCount: worsenedChanges.length,
    unchangedCount,
    meanSignedChange: average(changes),
    improvementRatio:
      worsenedChanges.length === 0
        ? improvedChanges.length > 0
          ? Number.POSITIVE_INFINITY
          : null
        : improvedChanges.length / worsenedChanges.length,
    improvementStats: {
      largest: orderedImprovements[0] ?? null,
      smallest: orderedImprovements[orderedImprovements.length - 1] ?? null,
      mean: average(improvedChanges),
      median: median(improvedChanges),
    },
    worseningStats: {
      largest: orderedWorsenings[0] ?? null,
      smallest: orderedWorsenings[orderedWorsenings.length - 1] ?? null,
      mean: average(worsenedChanges),
      median: median(worsenedChanges),
    },
  };
};

const ResultsComparisonTable: React.FC<ResultsComparisonTableProps> = ({
  referenceData,
  comparisonData,
  simulationParameters,
  className = "",
  selectedFragments,
  selectedModel,
}) => {
  const [showComparison, setShowComparison] = React.useState(true);

  const summaries = useMemo(() => {
    if (!referenceData || !comparisonData) {
      return [] as MetricSummary[];
    }

    return metricDefinitions.map((metric) =>
      summarizeMetric(metric, referenceData.results.data, comparisonData.results.data),
    );
  }, [comparisonData, referenceData]);

  const modelMetricRows = useMemo(() => {
    if (!referenceData || !comparisonData) {
      return [] as AggregateMetricRow[];
    }

    return buildAggregateMetricRows(
      referenceData.results.modelMetrics, 
      comparisonData.results.modelMetrics
    );
  }, [comparisonData, referenceData]);

  const regionMetricRows = useMemo(() => {
    if (!referenceData || !comparisonData) {
      return [] as AggregateMetricRow[];
    }

    return buildAggregateMetricRows(
      referenceData.results.fragmentMetrics,
      comparisonData.results.fragmentMetrics,
    );
  }, [comparisonData, referenceData]);

  const impactRows = useMemo(() => buildImpactRows(summaries), [summaries]);

  const detailSections = useMemo(() => buildDetailedSections(summaries), [summaries]);

  if (!referenceData || !comparisonData) {
    return null;
  }

  const referenceResidues = referenceData.results.data;
  const selectedResiduesCount = referenceResidues.filter((residue) => residue.selected).length;
  const totalResiduesCount = referenceResidues.length;

  const renderSummaryCell = (value: number | null) => {
    if (value === null) {
      return <span className="text-gray-400">—</span>;
    }

    if (value === Number.POSITIVE_INFINITY) {
      return <span>∞</span>;
    }

    return <span>{formatDelta(value)}</span>;
  };

  return (
    <div className={`rounded border border-gray-100 bg-white p-4 shadow-md ${className}`}>
      
      <div className="flex justify-between">
        <h2 className="font-medium">Refinement statistics</h2>
        <div
          onClick={() => setShowComparison(!showComparison)}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer select-none"
        >
          {showComparison ? "▼ Show" : "▲ Hide" }
        </div>
      </div>

      {!showComparison && (
        <div className="mt-4">
          <div className="mb-6">
            <p>
              <span className="font-semibold">Analysed region: </span>{selectedResiduesCount} nt selected from model {selectedModel} ({totalResiduesCount} nt total), residues {selectedFragments ? Object.entries(selectedFragments).map(([chain, region]) => `${chain}: ${region}`).join("; ") : "—"}
            </p>
          </div>

          <div className="mb-10">
            <h3 className="text-sm font-semibold text-gray-800">Refinement parameters</h3>
            {simulationParameters && simulationParameters.length > 0 && (
              <div className="mt-2 overflow-x-auto">
                <table className="border-separate border-spacing-0 text-sm text-gray-600">
                  <thead>
                    <tr>
                      {simulationParameters.filter((p): p is { label: string; value: string } => !!p.label).map((parameter) => (
                        <th
                          key={parameter.label}
                          className="whitespace-nowrap border-y border-gray-200 px-3 py-1 text-left font-semibold text-gray-700"
                        >
                          {parameter.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {simulationParameters.filter((p): p is { label: string; value: string } => !!p.label).map((parameter) => (
                        <td
                          key={parameter.label}
                          className="whitespace-nowrap border-y border-gray-100 px-3 py-1 text-left"
                        >
                          {formatSimulationParameterValue(parameter.value)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mb-10">
            <h3 className="text-sm font-semibold text-gray-800">Entire model metrics</h3>
            <div className="mt-2 max-w-6xl overflow-x-auto">
              <table className="w-fit border-separate border-spacing-0 text-sm">
               <thead>
                  <tr>
                    <th className="w-48 min-w-48 sticky left-0 z-10 border-y border-gray-200 bg-white px-3 py-2 text-left font-semibold text-gray-700"></th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Clash score</th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Bad bonds / all bonds (%)</th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Residues with bad bonds (%)</th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Bad angles / all angles (%)</th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Residues with bad angles (%)</th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Suite outliers</th>
                  </tr>
                </thead>
                <tbody>
                  {["Original structure (a)", "After refinement (b)", "Change: Δ = b - a"].map((rowLabel, rowIndex) => (
                    <tr key={rowLabel} className={rowIndex % 2 === 0 ? "bg-gray-50/70" : "bg-white"}>
                      <td className="w-48 min-w-48 sticky left-0 z-10 border-b border-gray-100 bg-inherit px-3 py-2 font-semibold text-gray-800">{rowLabel}</td>
                      {modelMetricRows.map((row) => {
                        const value = rowIndex === 0 ? row.referenceValue : rowIndex === 1 ? row.comparisonValue : row.deltaValue;
                        const displayValue = rowIndex === 0 ? row.referenceDisplay : rowIndex === 1 ? row.comparisonDisplay : null;
                        return (
                          <td key={`${row.key}-${rowLabel}`} className="w-36 min-w-36 border-b border-gray-100 px-3 py-2 text-gray-700">
                            {rowIndex === 2 ? formatDelta(value) : displayValue ?? formatValue(value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-10">
            <h3 className="text-sm font-semibold text-gray-800">Analysed region metrics</h3>
            <div className="mt-2 max-w-6xl overflow-x-auto">
              <table className="w-fit border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="w-48 min-w-48 sticky left-0 z-10 border-y border-gray-200 bg-white px-3 py-2 text-left font-semibold text-gray-700"></th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Clash score</th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Bad bonds / all bonds (%)</th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Residues with bad bonds (%)</th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Bad angles / all angles (%)</th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Residues with bad angles (%)</th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Suite outliers</th>
                  </tr>
                </thead>
                <tbody>
                  {["Original structure (a)", "After refinement (b)", "Change: Δ = b - a"].map((rowLabel, rowIndex) => (
                    <tr key={rowLabel} className={rowIndex % 2 === 0 ? "bg-gray-50/70" : "bg-white"}>
                      <td className="w-48 min-w-48 sticky left-0 z-10 border-b border-gray-100 bg-inherit px-3 py-2 font-semibold text-gray-800">{rowLabel}</td>
                      {regionMetricRows.map((row) => {
                        const value = rowIndex === 0 ? row.referenceValue : rowIndex === 1 ? row.comparisonValue : row.deltaValue;
                        const displayValue = rowIndex === 0 ? row.referenceDisplay : rowIndex === 1 ? row.comparisonDisplay : null;
                        return (
                          <td key={`${row.key}-${rowLabel}`} className="w-36 min-w-36 border-b border-gray-100 px-3 py-2 text-gray-700">
                            {rowIndex === 2 ? formatDelta(value) : displayValue ?? formatValue(value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-10">
            <h3 className="text-sm font-semibold text-gray-800">Refinement impact on the analysed region</h3>
            <div className="mt-2 max-w-7xl overflow-x-auto">
              <table className="w-fit border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="w-48 min-w-48 sticky left-0 z-10 border-y border-gray-200 bg-white px-3 py-2 text-left font-semibold text-gray-700"></th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Clash score</th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Bad bonds</th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Bad angles</th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Suiteness</th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Suite outliers</th>
                    <th className="w-36 min-w-36 border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Sugar Pucker Outliers</th>
                  </tr>
                </thead>
                <tbody>
                  {impactRows.map((row, index) => (
                    <tr key={row.label} className={index % 2 === 0 ? "bg-gray-50/70" : "bg-white"}>
                      <td className="w-48 min-w-48 sticky left-0 z-10 border-b border-gray-100 bg-inherit px-3 py-2 font-semibold text-gray-800">{row.label}</td>
                      {row.cells.map((cell) => (
                        <td key={`${row.label}-${cell.metricKey}`} className="w-36 min-w-36 border-b border-gray-100 px-3 py-2 text-gray-700">
                          {cell.value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Detailed refinement metrics for the analysed region</h3>
            <div className="mt-2 max-w-4xl overflow-x-auto">
              <table className="w-fit border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 w-32 min-w-32 whitespace-nowrap border-y border-gray-200 bg-white px-3 py-2 text-left font-semibold text-gray-700"></th>
                    <th className="border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Clash score</th>
                    <th className="border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Bad bonds</th>
                    <th className="border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Bad angles</th>
                    <th className="border-y border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Suiteness</th>
                  </tr>
                </thead>
                <tbody>
                  {detailSections.map((section, sectionIndex) => (
                    <React.Fragment key={section.title}>
                      <tr>
                        <td className="border-b border-gray-100 bg-gray-100 px-3 py-2 font-semibold text-gray-800" colSpan={5}>
                          {section.title}
                        </td>
                      </tr>
                      {section.rows.map((row, rowIndex) => (
                        <tr
                          key={`${section.title}-${row.label}`}
                          className={(sectionIndex + rowIndex) % 2 === 0 ? "bg-gray-50/70" : "bg-white"}
                        >
                          <td className="sticky left-0 z-10 w-32 min-w-32 whitespace-nowrap border-b border-gray-100 bg-inherit px-3 py-2 font-semibold text-gray-800">
                            {row.label}
                          </td>
                          {row.values.map((value, valueIndex) => (
                            <td key={`${section.title}-${row.label}-${detailedMetricKeys[valueIndex]}`} className="border-b border-gray-100 px-3 py-2 text-gray-700">
                              {renderSummaryCell(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsComparisonTable;