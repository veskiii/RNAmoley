import React from "react";

const fieldLabels = {
    // pdbFileName: "PDB File Name",
    // "x-H_type": "X-H Type",
    // chains: "Chains",
    residues: "Residues",
    // nucacids: "Nucleic Acids",
    // resolution: "Resolution",
    // rvalue: "R Value",
    // rfree: "R Free",
    clashscore: "Clashscore",
    // "clashscoreB<40": "Clashscore B<40",
    // minresol: "Min Resolution",
    // maxresol: "Max Resolution",
    // n_samples: "Number of Samples",
    // pct_rank: "Percentile Rank",
    // pct_rank40: "Percentile Rank 40",
    numbadbonds: "Number of Bad Bonds",
    numbonds: "Number of Bonds",
    pct_badbonds: "Percentage of Bad Bonds",
    pct_resbadbonds: "Percentage of Residues with Bad Bonds",
    numbadangles: "Number of Bad Angles",
    numangles: "Number of Angles",
    pct_badangles: "Percentage of Bad Angles",
    pct_resbadangles: "Percentage of Residues with Bad Angles",
    // chiralSwaps: "Chiral Swaps",
    // tetraOutliers: "Tetrahedral Outliers",
    // pseudochiralErrors: "Pseudochiral Errors",
    // waterClashes: "Water Clashes",
    // totalWaters: "Total Waters",
    // numPperpOutliers: "Num Pperp Outliers",
    // numPperp: "Num Pperp",
    numSuiteOutliers: "Number of Suite Outliers",
    numSuites: "Number of Suites",
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
            {Object.keys(fieldLabels)
                .map((key) => (
                    <tr key={key} className="even:bg-gray-50">
                        <td className="px-4 py-2 border-b border-gray-200">{fieldLabels[key]}</td>
                        <td className="px-4 py-2 border-b border-gray-200">
                            {modelMetrics[key] === "" ? <span className="text-gray-400">—</span> : modelMetrics[key]}
                        </td>
                        <td className="px-4 py-2 border-b border-gray-200">
                            {fragmentMetrics[key] === "" ? <span className="text-gray-400">—</span> : fragmentMetrics[key]}
                        </td>
                    </tr>
                ))}
        </tbody>
    </table>
);

export default GlobalResultsTable;
