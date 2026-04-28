import React, { useEffect, useState, useMemo } from "react";
import { QualityScore } from "../utils/types";
import { getColor } from "../utils/ColorUtils";
import { Colors } from "../common/colors";

const ResultsResidueTable = ({ data, analyzeNeighborhood, selectedScore, setSelectedScore, modelStatus }) => {
  const selectedBorderColor = Colors.salmon;
  const neighborhoodScores = [
    QualityScore.CLASH_SCORE,
    QualityScore.BAD_ANGLES,
    QualityScore.BAD_BONDS,
  ];

  const shouldHideSpinners = modelStatus === "completed" || (modelStatus && modelStatus.startsWith("sim_"));

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

  const handleClick = (clickedScore) => {
    setSelectedScore(clickedScore);
  };

  const getEffectiveSelectedScore = () => {
    if (!analyzeNeighborhood && neighborhoodScores.includes(selectedScore)) {
      return QualityScore.SUITENESS;
    }
    return selectedScore;
  };

  const effectiveSelectedScore = getEffectiveSelectedScore();

  const chainData = useMemo(() => {
    if (!data) return [];
    return data.filter((nucleotide) => nucleotide.chainID === selectedChain);
  }, [data, selectedChain]);

  const activeCellStyle = (residue, score) => {
    if (effectiveSelectedScore !== score) {
      return undefined;
    }
    return { backgroundColor: getColor(residue, score) };
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
          className="cursor-pointer"
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
            {chainData.map((nucleotide, index) => (
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
            {chainData.map((nucleotide, index) => (
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
            {chainData.map((nucleotide, index) => (
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
            {chainData.map((nucleotide, index) => (
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
            style={{
              borderWidth: "3px",
              borderColor:
                effectiveSelectedScore === QualityScore.CLASH_SCORE
                  ? selectedBorderColor
                  : "#a0b2a5",
            }}
            >
              Neighborhood ClashScore
            </td>
            {chainData.map((nucleotide, index) => (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide.residue_number}
                className={
                  "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2 border-moley-backgroundLightGreen column-CLASH_SCORE"
                }
                style={activeCellStyle(nucleotide, QualityScore.CLASH_SCORE)}
              >
                {nucleotide.metrics ? nucleotide.metrics.clashscore : 
                  !shouldHideSpinners && nucleotide.selected ? (
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
            style={{
              borderWidth: "3px",
              borderColor:
                effectiveSelectedScore === QualityScore.BAD_ANGLES
                  ? selectedBorderColor
                  : "#a0b2a5",
            }}
            >
              Neighborhood Bad Angles
            </td>
            {chainData.map((nucleotide, index) => (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide.residue_number}
                className={
                  "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2 border-moley-backgroundLightGreen column-BAD_ANGLES"
                }
                style={activeCellStyle(nucleotide, QualityScore.BAD_ANGLES)}
              >
                {nucleotide.metrics 
                ? `${nucleotide.metrics.numbadangles} / ${nucleotide.metrics.numangles} (${nucleotide.metrics.pct_badangles}%)`
                : 
                  !shouldHideSpinners && nucleotide.selected ? (
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
            style={{
              borderWidth: "3px",
              borderColor:
                effectiveSelectedScore === QualityScore.BAD_BONDS
                  ? selectedBorderColor
                  : "#a0b2a5",
            }}
            >
              Neighborhood Bad Bond Lengths
            </td>
            {chainData.map((nucleotide, index) => (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide.residue_number}
                className={
                  "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2 border-moley-backgroundLightGreen column-BAD_BONDS"
                }
                style={activeCellStyle(nucleotide, QualityScore.BAD_BONDS)}
              >
                {nucleotide.metrics 
                ? `${nucleotide.metrics.numbadbonds} / ${nucleotide.metrics.numbonds} (${nucleotide.metrics.pct_badbonds}%)`
                : 
                  !shouldHideSpinners && nucleotide.selected ? (
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
            style={{
              borderWidth: "3px",
              borderColor:
                effectiveSelectedScore === QualityScore.SUITENESS
                  ? selectedBorderColor
                  : "#a0b2a5",
            }}
            >
              Suiteness
            </td>
            {chainData.map((nucleotide, index) => (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide.residue_number}
                className={
                  "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2 border-moley-backgroundLightGreen column-SUITENESS"
                }
                style={activeCellStyle(nucleotide, QualityScore.SUITENESS)}
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
            style={{
              borderWidth: "3px",
              borderColor:
                effectiveSelectedScore === QualityScore.SUGAR_PUCKER_OUT
                  ? selectedBorderColor
                  : "#a0b2a5",
            }}
            >
              Sugar Pucker Outlier Type
            </td>
            {chainData.map((nucleotide, index) => (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide.residue_number}
                className={
                  "w-12 p-2 bg-moley-backgroundLightGreen text-center border-2 border-moley-backgroundLightGreen column-SUGAR_PUCKER_OUT"
                }
                style={activeCellStyle(nucleotide, QualityScore.SUGAR_PUCKER_OUT)}
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
