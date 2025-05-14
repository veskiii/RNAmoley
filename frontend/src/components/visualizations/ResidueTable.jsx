import React from "react";

const ResidueTable = ({ data, selectedChain }) => {
  if (!data || data.length === 0) {
    return <p>No data available</p>;
  }
  const selectedChainData = data.find(
    (chain) => chain.name.slice(-1) === selectedChain
  );
  console.log("Selected chain data:", selectedChainData);
  if (!selectedChainData) {
    return <p>No data available for the selected chain {selectedChain}</p>;
  }

  return (
    <table className="mt-4 w-max border-separate border-spacing-1">
      <tbody>
        <tr>
          <td className="w-32 p-2 bg-gray-400 text-center">Index</td>
          {selectedChainData.nucleotides.map((nucleotide, index) => (
            <td
              key={`${selectedChain}-id-${index}`}
              className="w-12 p-2 bg-gray-300 text-center"
            >
              {nucleotide.original_index}
            </td>
          ))}
        </tr>
        <tr>
          <td className="w-32 p-2 bg-gray-400 text-center">Base</td>
          {selectedChainData.nucleotides.map((nucleotide, index) => (
            <td
              key={`${selectedChain}-name-${index}`}
              className="w-12 p-2 bg-gray-300 text-center"
            >
              {nucleotide.base}
            </td>
          ))}
        </tr>
        <tr>
          <td className="w-32 p-2 bg-gray-400 text-center">
            Secondary Structure
          </td>
          {selectedChainData.nucleotides.map((nucleotide, index) => (
            <td
              key={`${selectedChain}-index-${index}`}
              className="w-12 p-2 bg-gray-300 text-center"
            >
              {nucleotide.structure}
            </td>
          ))}
        </tr>
        <tr>
          <td className="w-32 p-2 bg-gray-400 text-center">
            Structural Element
          </td>
          {selectedChainData.nucleotides.map((_, index) => (
            <td
              key={`${selectedChain}-name-${index}`}
              className="w-12 p-2 bg-gray-300 text-center"
            >
              x
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
};

export default ResidueTable;
