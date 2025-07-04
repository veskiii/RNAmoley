import React, { useEffect } from "react";

const ResidueTable = ({ data, selectedChain, selectedResidueIds, selectFragment, deselectFragment, selectResidue, deselectResidue, }) => {
  useEffect(() => {
    console.log("ResidueTable rerendered");
    console.log("selectedResidueIds:", selectedResidueIds);
  }, [selectedResidueIds, selectedChain, data]);

  if (!data || data.length === 0) {
    return <p>No data available</p>;
  }
  const selectedChainData = data.find(
    (chain) => chain.name.slice(-1) === selectedChain
  );
  if (!selectedChainData) {
    return <p>No data available for the selected chain {selectedChain}</p>;
  }

  const handleResidueClick = (index) => {
    console.log(`Residue ${index} clicked`);
    console.log(data);
    // setData(prevChains =>
      data.map(chain => {
        if (chain.name.slice(-1) === selectedChain) {
          return {
            ...chain,
            nucleotides: chain.nucleotides.map(nucleotide => {
              if (nucleotide.index === index) {
                if (nucleotide.selected) {
                  deselectResidue(selectedChain, nucleotide.index);
                }
                else {
                  selectResidue(selectedChain, nucleotide.index);
                }
                return {
                  ...nucleotide,
                  selected: !nucleotide.selected,
                }
              }
              else return nucleotide;
            }),
          };
        }
        return chain;
    })//);
  }

  const handleStructuralElementClick = (index) => {
    console.log(`Structural element of residue ${index} clicked`);
    console.log(data);
    // setData(prevChains =>
      data.map(chain => {
        if (chain.name.slice(-1) === selectedChain) {
          const clickedNucleotide = chain.nucleotides.find( nucleotide => nucleotide.index === index);
          const clickedStructuralNames = clickedNucleotide.structuralElements.map(el => el.name);
          const SEResidues = chain.nucleotides.filter(nucleotide =>
            nucleotide.structuralElements.some(el => clickedStructuralNames.includes(el.name)));
          const allResiduesSelected = !SEResidues.some( nucleotide => nucleotide.selected === false);

          const updatedNucleotides = chain.nucleotides.map(nucleotide => {
              const hasCommonStructuralElement = nucleotide.structuralElements.some(structuralElement =>
                clickedStructuralNames.includes(structuralElement.name)
              );
              if (hasCommonStructuralElement && !allResiduesSelected) {
                return {
                  ...nucleotide,
                  selected: allResiduesSelected ? false : true,
                }
              }
              else return nucleotide;
          })
          
          if (allResiduesSelected) {
            // Dla każdego elementu strukturalnego klikniętego nukleotydu wywołaj deselectFragment
            clickedStructuralNames.forEach(name => {
              deselectFragment(name);
            });
          } else {
            // Dla każdego elementu strukturalnego klikniętego nukleotydu wywołaj selectFragment
            clickedStructuralNames.forEach(name => {
              selectFragment(name, selectedChain, SEResidues
                .filter(nuc =>
                  nuc.structuralElements.some(el => el.name === name)
                )
                .map(nuc => nuc.index)
              );
            });
          }

          return {
            ...chain,
            nucleotides: updatedNucleotides,
          };
        }
        return chain;
    })//);
  }

  return (
    <table className="mt-4 w-max border-separate border-spacing-1">
      <tbody>
        <tr>
          <td className="w-32 p-2 bg-moley-backgroundGreen text-center">Index</td>
          {selectedChainData.nucleotides.map((nucleotide, index) => (
            <td
              key={`${selectedChain}-id-${index}`}
              className={[
                "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2",
                selectedResidueIds.includes(index + 1)
                  ? "border-moley-accentGreen"
                  : "border-moley-backgroundLightGreen"
              ].join(" ")}
              onClick={() => handleResidueClick(index + 1)}
            >
              {nucleotide.original_index}
            </td>
          ))}
        </tr>
        <tr>
          <td className="w-32 p-2 bg-moley-backgroundGreen text-center">Base</td>
          {selectedChainData.nucleotides.map((nucleotide, index) => (
            <td
              key={`${selectedChain}-name-${index}`}
              className={[
                "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2",
                selectedResidueIds.includes(index + 1)
                  ? "border-moley-accentGreen"
                  : "border-gray-300"
              ].join(" ")}
              onClick={() => handleResidueClick(index + 1)}
            >
              {nucleotide.base}
            </td>
          ))}
        </tr>
        <tr>
          <td className="w-32 p-2 bg-moley-backgroundGreen text-center">
            Secondary Structure
          </td>
          {selectedChainData.nucleotides.map((nucleotide, index) => (
            <td
              key={`${selectedChain}-index-${index}`}
              className={[
                "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2",
                selectedResidueIds.includes(index + 1)
                  ? "border-moley-accentGreen"
                  : "border-moley-backgroundLightGreen"
              ].join(" ")}
              onClick={() => handleResidueClick(index + 1)}
            >
              {nucleotide.structure}
            </td>
          ))}
        </tr>
        <tr>
          <td className="w-32 p-2 bg-moley-backgroundGreen text-center">
            Structural Element
          </td>
          {selectedChainData.nucleotides.map((nucleotide, index) => (
            <td
              key={`${selectedChain}-name-${index}`}
              className="w-12 p-2 bg-moley-backgroundLightGreen text-center"
              onClick={() => handleStructuralElementClick(index + 1)}
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
