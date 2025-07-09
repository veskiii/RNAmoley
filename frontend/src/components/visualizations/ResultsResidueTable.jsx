import React, { useEffect, useState, useMemo } from "react";
import { QualityScore } from "../utils/types";
import { getColor } from "../utils/ColorUtils";
import { Colors } from "../common/colors";

const ResultsResidueTable = ({ data }) => {
  const devColor = "#f3f4f6";
  const selectedBorderColor = Colors.salmon;

  const chainOptions = useMemo(() => {
    if (!data || data.length === 0) return [];
    const chainsSet = new Set();
    console.log(data.length);
    data.forEach((nucleotide) => {
      if (nucleotide.chainID) {
        chainsSet.add(nucleotide.chainID);
      }
    });
    return Array.from(chainsSet);
  }, [data]);

  const [selectedChain, setSelectedChain] = useState(() =>
    chainOptions.length > 0 ? chainOptions[0] : ""
  );

  function colorColumn(selectedScore = QualityScore.CLASH_SCORE) {
    const getEnumKeyByValue = (value) => {
      return Object.keys(QualityScore).find(
        (key) => QualityScore[key] === value
      );
    };

    const score = getEnumKeyByValue(selectedScore);

    if (data) {
      document
        .querySelectorAll(`td[class*="column-${score}"]`)
        .forEach((cell, index) => {
          const residue = data[index];
          if (residue) {
            cell.style.backgroundColor = getColor(
              residue,
              selectedScore
            );
          }
        });
    }
    return <div></div>;
  }

  const resetColumns = () => {
    [
      "CLASH_SCORE",
      "BAD_ANGLES",
      "BAD_BONDS",
      "SUGAR_PUCKER_OUT",
      "SUITENESS",
    ].forEach((column) => {
      document.querySelectorAll(`.column-${column}`).forEach((cell, index) => {
        cell.style.backgroundColor = "#c4cbc4";
      });
    });
  };

  const handleClick = (selectedScore) => {
    resetColumns();

    const ids = [
      "tableClashscore",
      "tableBadAngles",
      "tableBadBonds",
      "tableSuiteness",
      "tableSugarPuckerOut",
    ];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.backgroundColor = "#a0b2a5";
        el.style.borderColor = "#a0b2a5";
      }
    });

    const scoreToId = {
      [QualityScore.CLASH_SCORE]: "tableClashscore",
      [QualityScore.BAD_ANGLES]: "tableBadAngles",
      [QualityScore.BAD_BONDS]: "tableBadBonds",
      [QualityScore.SUITENESS]: "tableSuiteness",
      [QualityScore.SUGAR_PUCKER_OUT]: "tableSugarPuckerOut",
    };

    const selectedId = scoreToId[selectedScore];
    const selectedEl = document.getElementById(selectedId);
    if (selectedEl) {
      selectedEl.style.borderColor = selectedBorderColor;
      selectedEl.style.borderWidth = "3px";
    }
    colorColumn(selectedScore);
  };

  useEffect(() => {
    if (chainOptions.length > 0 && !chainOptions.includes(selectedChain)) {
      setSelectedChain(chainOptions[0]);
    }
  }, [chainOptions]);

  useEffect(() => {
    console.log("ResidueTable rerendered");
  }, [selectedChain]);

  useEffect(() => {
    colorColumn(QualityScore.CLASH_SCORE);
  }, [data]);

  if (!data || data.length === 0) {
    return <p>No data available</p>;
  }

  const selectedChainData =
    data.find(
      (chain) =>
        (chain.nucleotides &&
          chain.nucleotides.length > 0 &&
          chain.nucleotides[0].chainID === selectedChain) ||
        (chain.name && chain.name.slice(-1) === selectedChain)
    ) || data[0];
    console.log("Data: ", data);
    console.log("Selected chain data:", selectedChainData);

  if (!selectedChainData) {
    return <p>No data available for the selected chain {selectedChain}</p>;
  }


  return (
    <div>
      <div className="mb-2">
        <label htmlFor="chain-select" className="mr-2">
          Select chain:
        </label>
        <select
          id="chain-select"
          value={selectedChain}
          onChange={(e) => setSelectedChain(e.target.value)}
        >
          {chainOptions.map((chainId) => (
            <option key={chainId} value={chainId}>
              {chainId}
            </option>
          ))}
        </select>
      </div>
      <table className="mt-4 w-max border-separate border-spacing-1">
        <tbody>
          <tr>
            <td className="w-32 p-2 bg-moley-backgroundGreen text-center">Index</td>
            {data && data.filter((nucleotide) => nucleotide.chainID === selectedChain).map((nucleotide, index) => (
              <td
                key={`${selectedChain}-id-${index}`}
                className={
                  "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2 border-moley-backgroundLightGreen"
                }
              >
                {nucleotide.original_index}
              </td>
            ))}
          </tr>
          <tr>
            <td className="w-32 p-2 bg-moley-backgroundGreen text-center">Base</td>
            {data && data.filter((nucleotide) => nucleotide.chainID === selectedChain).map((nucleotide, index) => (
              <td
                key={`${selectedChain}-name-${index}`}
                className={
                  "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2 border-moley-backgroundLightGreen"
                }
              >
                {nucleotide.base}
              </td>
            ))}
          </tr>
          <tr>
            <td className="w-32 p-2 bg-moley-backgroundGreen text-center">
              Secondary Structure
            </td>
            {data && data.filter((nucleotide) => nucleotide.chainID === selectedChain).map((nucleotide, index) => (
              <td
                key={`${selectedChain}-index-${index}`}
                className={
                  "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2 border-moley-backgroundLightGreen"
                }
              >
                {nucleotide.structure}
              </td>
            ))}
          </tr>
          <tr>
            <td className="w-32 p-2 bg-moley-backgroundGreen text-center">
              Structural Element
            </td>
            {data && data.filter((nucleotide) => nucleotide.chainID === selectedChain).map((nucleotide, index) => (
              <td
                key={`${selectedChain}-struct-${index}`}
                className={
                  "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2 border-moley-backgroundLightGreen"
                }
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
          <tr>
            <td
            id="tableClashscore"
            className="w-32 p-2 bg-moley-backgroundGreen text-center border-moley-backgroundGreen cursor-pointer"
            onClick={(_) => handleClick(QualityScore.CLASH_SCORE)}
            style={{borderWidth: "3px"}}
            >
              Neighborhood ClashScore
            </td>
            {data && data.filter((nucleotide) => nucleotide.chainID === selectedChain).map((nucleotide, index) => (
              <td
                key={`${selectedChain}-struct-${index}`}
                className={
                  "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2 border-moley-backgroundLightGreen column-CLASH_SCORE"
                }
              >
                {nucleotide.metrics ? nucleotide.metrics.clashscore : ""}
              </td>
            ))}
          </tr>
          <tr>
            <td 
            id="tableBadAngles"
            className="w-32 p-2 bg-moley-backgroundGreen text-center border-moley-backgroundGreen cursor-pointer"
            onClick={(_) => handleClick(QualityScore.BAD_ANGLES)}
            style={{borderWidth: "3px"}}
            >
              Neighborhood Bad Angles
            </td>
            {data && data.filter((nucleotide) => nucleotide.chainID === selectedChain).map((nucleotide, index) => (
              <td
                key={`${selectedChain}-struct-${index}`}
                className={
                  "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2 border-moley-backgroundLightGreen column-BAD_ANGLES"
                }
              >
                {nucleotide.metrics 
                ? `${nucleotide.metrics.numbadangles} / ${nucleotide.metrics.numangles} (${nucleotide.metrics.pct_badangles}%)`
                : ""}
              </td>
            ))}
          </tr>
          <tr>
            <td 
            id="tableBadBonds"
            className="w-32 p-2 bg-moley-backgroundGreen text-center border-moley-backgroundGreen cursor-pointer"
            onClick={(_) => handleClick(QualityScore.BAD_BONDS)}
            style={{borderWidth: "3px"}}
            >
              Neighborhood Bad Bond Lengths
            </td>
            {data && data.filter((nucleotide) => nucleotide.chainID === selectedChain).map((nucleotide, index) => (
              <td
                key={`${selectedChain}-struct-${index}`}
                className={
                  "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2 border-moley-backgroundLightGreen column-BAD_BONDS"
                }
              >
                {nucleotide.metrics 
                ? `${nucleotide.metrics.numbadbonds} / ${nucleotide.metrics.numbonds} (${nucleotide.metrics.pct_badbonds}%)`
                : ""}
              </td>
            ))}
          </tr>
          <tr>
            <td 
            id="tableSuiteness"
            className="w-32 p-2 bg-moley-backgroundGreen text-center border-moley-backgroundGreen cursor-pointer"
            onClick={(_) => handleClick(QualityScore.SUITENESS)}
            style={{borderWidth: "3px"}}
            >
              Suiteness
            </td>
            {data && data.filter((nucleotide) => nucleotide.chainID === selectedChain).map((nucleotide, index) => (
              <td
                key={`${selectedChain}-struct-${index}`}
                className={
                  "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2 border-moley-backgroundLightGreen column-SUITENESS"
                }
              >
                {nucleotide.residueMetrics ? nucleotide.residueMetrics.suiteness : ""}
              </td>
            ))}
          </tr>
          <tr>
            <td 
            id="tableSugarPuckerOut"
            className="w-32 p-2 bg-moley-backgroundGreen text-center border-moley-backgroundGreen cursor-pointer"
            onClick={(_) => handleClick(QualityScore.SUGAR_PUCKER_OUT)}
            style={{borderWidth: "3px"}}
            >
              Sugar Pucker Outlier Type
            </td>
            {data && data.filter((nucleotide) => nucleotide.chainID === selectedChain).map((nucleotide, index) => (
              <td
                key={`${selectedChain}-struct-${index}`}
                className={
                  "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2 border-moley-backgroundLightGreen column-SUGAR_PUCKER_OUT"
                }
              >
                {nucleotide.residueMetrics ? nucleotide.residueMetrics.pucker_outlier_type : ""}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ResultsResidueTable;
