import React from "react";
import { formatNumberForDisplay } from "../utils/displayUniform";

const fieldRows = [
    {
        label: "Length [nt]",
        key: "residues",
    },
    {
        label: "Clash score",
        key: "clashscore",
    },
    {
        label: "Bad bonds",
        keys: ["numbadbonds", "numbonds", "pct_badbonds"],
    },
    {
        label: "Residues with bad bonds [%]",
        key: "pct_resbadbonds",
    },
    {
        label: "Bad angles",
        keys: ["numbadangles", "numangles", "pct_badangles"],
    },
    {
        label: "Residues with bad angles [%]",
        key: "pct_resbadangles",
    },
    {
        label: "Suite outliers",
        keys: ["numSuiteOutliers", "numSuites"],
    },
];

const renderMetricValue = (metrics, key) => {
    if (!metrics || metrics[key] === undefined || metrics[key] === null || metrics[key] === "") {
        return <span className="text-gray-400">—</span>;
    }

    return formatNumberForDisplay(metrics[key].toString());
};

const renderCombinedMetricValue = (metrics, keys) => {
    const values = keys
        .map((key) => metrics?.[key])
        .filter((value) => value !== undefined && value !== null && value !== "");

    if (values.length === 0) {
        return <span className="text-gray-400">—</span>;
    }

    if (values.length === 3) {
        return `${formatNumberForDisplay(values[0].toString())} / ${formatNumberForDisplay(values[1].toString())} (${formatNumberForDisplay(values[2].toString())}%)`;
    }

    return values.map((value) => formatNumberForDisplay(value.toString())).join(" / ");
};

const GlobalResultsTable = ({ selectedModel, modelMetrics, fragmentMetrics, simModelMetrics, simFragmentMetrics }) => {
    const rows = [
        { label: `Entire model ${selectedModel || "<X>}"}`, metrics: modelMetrics },
        simModelMetrics && { label: `Entire model ${selectedModel || "<X>"} (after refinement)`, metrics: simModelMetrics },
        { label: "Analysed region", metrics: fragmentMetrics },
        simFragmentMetrics && { label: "Analysed region (after refinement)", metrics: simFragmentMetrics },
    ];

    return (
        <table className="min-w-full border-t border-gray-300 rounded-lg">
            <thead>
                <tr>
                    <th className="px-4 py-2 border-b border-gray-300 text-left font-semibold"></th>
                    {fieldRows.map((field) => (
                        <th
                            key={field.label}
                            className="px-4 py-2 border-b border-gray-300 text-left font-semibold"
                        >
                            {field.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.filter(Boolean).map((row) => (
                    <tr key={row.label} className="even:bg-gray-50">
                        <td className="px-4 py-2 border-b border-gray-200 font-semibold">{row.label}</td>
                        {fieldRows.map((field) => (
                            <td key={`${row.label}-${field.label}`} className="px-4 py-2 border-b border-gray-200">
                                {field.keys
                                    ? renderCombinedMetricValue(row.metrics, field.keys)
                                    : renderMetricValue(row.metrics, field.key)}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default GlobalResultsTable;
