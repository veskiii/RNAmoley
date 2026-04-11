import React from "react";

const fieldRows = [
    {
        label: "Residues",
        key: "residues",
    },
    {
        label: "Clashscore",
        key: "clashscore",
    },
    {
        label: "Bad Bond Lengths",
        keys: ["numbadbonds", "numbonds", "pct_badbonds"],
    },
    {
        label: "Percentage of Residues with Bad Bonds",
        key: "pct_resbadbonds",
    },
    {
        label: "Bad Bond Angles",
        keys: ["numbadangles", "numangles", "pct_badangles"],
    },
    {
        label: "Percentage of Residues with Bad Angles",
        key: "pct_resbadangles",
    },
    {
        label: "Suite Outliers",
        keys: ["numSuiteOutliers", "numSuites"],
    },
];

const renderMetricValue = (metrics, key) => {
    if (!metrics || metrics[key] === undefined || metrics[key] === null || metrics[key] === "") {
        return <span className="text-gray-400">—</span>;
    }

    return metrics[key];
};

const renderCombinedMetricValue = (metrics, keys) => {
    const values = keys
        .map((key) => metrics?.[key])
        .filter((value) => value !== undefined && value !== null && value !== "");

    if (values.length === 0) {
        return <span className="text-gray-400">—</span>;
    }

    if (values.length === 3) {
        return `${values[0]} / ${values[1]} (${values[2]}%)`;
    }

    return values.join(" / ");
};

const GlobalResultsTable = ({ modelMetrics, fragmentMetrics }) => (
    <table className="min-w-full border border-gray-300 rounded-lg">
        <thead>
            <tr>
                <th className="px-4 py-2 border-b border-gray-300 bg-moley-backgroundGreen text-left font-semibold">Parameter</th>
                <th className="px-4 py-2 border-b border-gray-300 bg-moley-backgroundGreen text-left font-semibold">Model Value</th>
                <th className="px-4 py-2 border-b border-gray-300 bg-moley-backgroundGreen text-left font-semibold">Fragment Value</th>
            </tr>
        </thead>
        <tbody>
            {fieldRows.map((row) => (
                <tr key={row.label} className="even:bg-gray-50">
                    <td className="px-4 py-2 border-b border-gray-200">{row.label}</td>
                    <td className="px-4 py-2 border-b border-gray-200">
                        {row.keys
                            ? renderCombinedMetricValue(modelMetrics, row.keys)
                            : renderMetricValue(modelMetrics, row.key)}
                    </td>
                    <td className="px-4 py-2 border-b border-gray-200">
                        {row.keys
                            ? renderCombinedMetricValue(fragmentMetrics, row.keys)
                            : renderMetricValue(fragmentMetrics, row.key)}
                    </td>
                </tr>
            ))}
        </tbody>
    </table>
);

export default GlobalResultsTable;
