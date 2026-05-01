import React, { useMemo } from "react";

const ResidueTable = ({ data, selectedChain, selectedResidueIds, selectFragment, deselectFragment, selectResidue, deselectResidue, }) => {
  const selectedResidueIdSet = useMemo(
    () => new Set(selectedResidueIds || []),
    [selectedResidueIds]
  );

  if (!data || data.length === 0) {
    return <div></div>;
  }

  const selectedChainData = data.find(
    (chain) => chain.name === selectedChain
  );
  if (!selectedChain) {
    return <div></div>;
  }
  if (!selectedChainData) {
    return <p>No data available for the selected chain {selectedChain}</p>;
  }

  const handleResidueClick = (index) => {
    const nucleotide = selectedChainData.nucleotides.find((n) => n.index === index);
    if (!nucleotide) return;

    if (nucleotide.selected) {
      deselectResidue(selectedChain, nucleotide.index);
    } else {
      selectResidue(selectedChain, nucleotide.index);
    }
  }

  const handleStructuralElementClick = (index) => {
    const clickedNucleotide = selectedChainData.nucleotides.find(
      (nucleotide) => nucleotide.index === index
    );
    if (!clickedNucleotide) return;

    const clickedStructuralNames = clickedNucleotide.structuralElements.map((el) => el.name);
    const SEResidues = selectedChainData.nucleotides.filter((nucleotide) =>
      nucleotide.structuralElements.some((el) => clickedStructuralNames.includes(el.name))
    );
    const allResiduesSelected = !SEResidues.some((nucleotide) => nucleotide.selected === false);

    if (allResiduesSelected) {
      clickedStructuralNames.forEach((name) => {
        deselectFragment(name, clickedStructuralNames);
      });
    } else {
      clickedStructuralNames.forEach((name) => {
        selectFragment(
          name,
          selectedChain,
          SEResidues
            .filter((nuc) => nuc.structuralElements.some((el) => el.name === name))
            .map((nuc) => nuc.index)
        );
      });
    }
  }

  return (
    <table className="mt-4 w-max border-separate">
      <tbody>
        <tr>
          <td className="w-32 p-2 text-center">Index</td>
          {selectedChainData.nucleotides.map((nucleotide, index) => (
            <td
              key={`${selectedChain}-id-${index}`}
              className={[
                "w-12 p-2 text-center border-2 cursor-pointer even:bg-gray-50",
                selectedResidueIdSet.has(nucleotide.index)
                  ? "border-moley-accentGreen"
                  : "border-white"
              ].join(" ")}
              onClick={() => handleResidueClick(nucleotide.index)}
            >
              {nucleotide.original_index}
            </td>
          ))}
        </tr>
        <tr>
          <td className="w-32 p-2 text-center">Residue</td>
          {selectedChainData.nucleotides.map((nucleotide, index) => (
            <td
              key={`${selectedChain}-name-${index}`}
              className={[
                "w-12 p-2 text-center border-2 cursor-pointer even:bg-gray-50",
                selectedResidueIdSet.has(nucleotide.index)
                  ? "border-moley-accentGreen"
                  : "border-white"
              ].join(" ")}
              onClick={() => handleResidueClick(nucleotide.index)}
            >
              {nucleotide.base}
            </td>
          ))}
        </tr>
        <tr>
          <td className="w-32 p-2 text-center">
            Secondary Structure
          </td>
          {selectedChainData.nucleotides.map((nucleotide, index) => (
            <td
              key={`${selectedChain}-index-${index}`}
              className={[
                "w-12 p-2 text-center border-2 cursor-pointer even:bg-gray-50",
                selectedResidueIdSet.has(nucleotide.index)
                  ? "border-moley-accentGreen"
                  : "border-white"
              ].join(" ")}
              onClick={() => handleResidueClick(nucleotide.index)}
            >
              {nucleotide.structure}
            </td>
          ))}
        </tr>
        <tr>
          <td className="w-32 p-2 text-center">
            Structural Element
          </td>
          {selectedChainData.nucleotides.map((nucleotide, index) => (
            <td
              key={`${selectedChain}-name-${index}`}
              className="w-12 p-2 text-center border-2 border-white cursor-pointer even:bg-gray-50"
              onClick={() => handleStructuralElementClick(nucleotide.index)}
            >
              {nucleotide.structuralElements && nucleotide.structuralElements.length > 0
                                                    ? nucleotide.structuralElements
                                                        .map((el) => el.name)
                                                        .filter(Boolean)
                                                        .join(", ")
                                                    : ""}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
};

export default ResidueTable;
