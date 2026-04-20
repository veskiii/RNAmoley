import React, { useEffect, useState, useMemo } from "react";
import { QualityScore } from "../utils/types";
import { getColor } from "../utils/ColorUtils";
import { Colors } from "../common/colors";

const ResultsResidueTable = ({ data, analyzeNeighborhood, selectedScore, setSelectedScore }) => {
  const selectedBorderColor = Colors.salmon;
  const neighborhoodScores = [
    QualityScore.CLASH_SCORE,
    QualityScore.BAD_ANGLES,
    QualityScore.BAD_BONDS,
  ];

  const chainOptions = useMemo(() => {
    if (!data || data.length === 0) return [];
    const chainsMap = new Map();
    data.forEach((nucleotide) => {
      if (nucleotide.chainID && !chainsMap.has(nucleotide.chainID)) {
      chainsMap.set(nucleotide.chainID, {
        chainID: nucleotide.chainID,
        original_chain_id: nucleotide.original_chain_id,
      });
      }
    });
    return Array.from(chainsMap.values());
  }, [data]);

  const [selectedChain, setSelectedChain] = useState(() =>
    chainOptions.length > 0 ? chainOptions[0].chainID : ""
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
        .forEach((cell) => {
          const keyAttr = cell.getAttribute("data-residue-number");
          if (keyAttr) {
            const residue = data.find(nuc => String(nuc.residue_number) === keyAttr);
            if (residue) {
              cell.style.backgroundColor = getColor(
                residue,
                selectedScore
              );
            }
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

  const handleClick = (clickedScore) => {
    setSelectedScore(clickedScore);
  };

  const getEffectiveSelectedScore = () => {
    if (!analyzeNeighborhood && neighborhoodScores.includes(selectedScore)) {
      return QualityScore.SUITENESS;
    }
    return selectedScore;
  };

  useEffect(() => {
    if (
      chainOptions.length > 0 &&
      !chainOptions.some(option => option.chainID === selectedChain)
    ) {
      setSelectedChain(chainOptions[0].chainID);
    }
  }, [chainOptions, selectedChain]);

  useEffect(() => {
    // console.log("ResidueTable rerendered");
  }, [selectedChain]);

  useEffect(() => {
    if (!analyzeNeighborhood && neighborhoodScores.includes(selectedScore)) {
      setSelectedScore(QualityScore.SUITENESS);
    }
  }, [analyzeNeighborhood, selectedScore, setSelectedScore]);

  useEffect(() => {
    const effectiveSelectedScore = getEffectiveSelectedScore();

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

    const selectedId = scoreToId[effectiveSelectedScore];
    const selectedEl = document.getElementById(selectedId);
    if (selectedEl) {
      selectedEl.style.borderColor = selectedBorderColor;
      selectedEl.style.borderWidth = "3px";
    }
    colorColumn(effectiveSelectedScore);
  }, [data, selectedScore, selectedChain, analyzeNeighborhood]);

  if (!data || data.length === 0) {
    return <p>No data available</p>;
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
          {chainOptions.map((chain) => (
            <option key={chain.chainID} value={chain.chainID}>
              {chain.original_chain_id}
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
          { analyzeNeighborhood && (
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
                data-residue-number={nucleotide.residue_number}
                className={
                  "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2 border-moley-backgroundLightGreen column-CLASH_SCORE"
                }
              >
                {nucleotide.metrics ? nucleotide.metrics.clashscore : 
                  nucleotide.selected ? (
                    <span className="inline-block align-middle">
                      <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500"></span>
                    </span>
                  ) : ""}
              </td>
            ))}
          </tr>)}
          {analyzeNeighborhood && (
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
                data-residue-number={nucleotide.residue_number}
                className={
                  "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2 border-moley-backgroundLightGreen column-BAD_ANGLES"
                }
              >
                {nucleotide.metrics 
                ? `${nucleotide.metrics.numbadangles} / ${nucleotide.metrics.numangles} (${nucleotide.metrics.pct_badangles}%)`
                : 
                  nucleotide.selected ? (
                    <span className="inline-block align-middle">
                      <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500"></span>
                    </span>
                  ) : ""}
              </td>
            ))}
          </tr>)}
          {analyzeNeighborhood && (
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
                data-residue-number={nucleotide.residue_number}
                className={
                  "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2 border-moley-backgroundLightGreen column-BAD_BONDS"
                }
              >
                {nucleotide.metrics 
                ? `${nucleotide.metrics.numbadbonds} / ${nucleotide.metrics.numbonds} (${nucleotide.metrics.pct_badbonds}%)`
                : 
                  nucleotide.selected ? (
                    <span className="inline-block align-middle">
                      <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500"></span>
                    </span>
                  ) : ""}
              </td>
            ))}
          </tr>)}
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
                data-residue-number={nucleotide.residue_number}
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
                data-residue-number={nucleotide.residue_number}
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
      {/* Spinner CSS */}
      <style>
        {`
          .animate-spin {
            display: inline-block;
            border-radius: 9999px;
            border-width: 2px;
            border-style: solid;
            border-color: #d1d5db transparent #d1d5db transparent;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default ResultsResidueTable;
