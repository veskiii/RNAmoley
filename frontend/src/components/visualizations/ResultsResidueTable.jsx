import React, { useEffect, useMemo } from "react";
import { QualityScore } from "../utils/types";
import { getColor } from "../utils/ColorUtils";
import { Colors } from "../common/colors";

const ResultsResidueTable = ({ data, analyzeNeighborhood, selectedScore, setSelectedScore, modelStatus, selectedChain }) => {
  const selectedBorderColor = Colors.white; // Colors.salmon;
  const neighborhoodScores = [
    QualityScore.CLASH_SCORE,
    QualityScore.BAD_ANGLES,
    QualityScore.BAD_BONDS,
  ];

  const shouldHideSpinners = modelStatus === "completed" || (modelStatus && modelStatus.startsWith("sim_"));

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

  const tableColumns = useMemo(() => {
    if (!data) return [];

    const chainData = data.filter((nucleotide) => nucleotide.chainID === selectedChain);
    const columns = [];

    const isConsecutive = (left, right) => {
      const leftIndex = Number(left?.original_index);
      const rightIndex = Number(right?.original_index);

      if (Number.isFinite(leftIndex) && Number.isFinite(rightIndex)) {
        return rightIndex === leftIndex + 1;
      }

      return true;
    };

    for (let i = 0; i < chainData.length; i += 1) {
      const nucleotide = chainData[i];

      if (nucleotide.selected) {
        columns.push({ type: "nucleotide", nucleotide });
        continue;
      }

      let end = i;
      while (
        end + 1 < chainData.length &&
        !chainData[end + 1].selected &&
        isConsecutive(chainData[end], chainData[end + 1])
      ) {
        end += 1;
      }

      const startIndex = chainData[i].original_index;
      const endIndex = chainData[end].original_index;
      const label = startIndex === endIndex ? `${startIndex}` : `${startIndex}-${endIndex}`;

      columns.push({
        type: "not-selected-range",
        startIndex,
        endIndex,
        label,
      });

      i = end;
    }

    return columns;
  }, [data, selectedChain]);

  const getColumnNucleotide = (column) => (column.type === "nucleotide" ? column.nucleotide : null);

  const activeCellStyle = (column, score) => {
    const residue = getColumnNucleotide(column);
    if (!residue) {
      return undefined;
    }
    if (effectiveSelectedScore !== score) {
      return undefined;
    }
    return { backgroundColor: getColor(residue, score) };
  };

  // useEffect(() => {
  //   if (
  //     chainOptions.length > 0 &&
  //     !chainOptions.some(option => option.chainID === selectedChain)
  //   ) {
  //     setSelectedChain(chainOptions[0].chainID);
  //   }
  // }, [chainOptions, selectedChain]);

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
      <table className="mt-4 w-max border-separate border-spacing-1">
        <tbody>
          <tr>
            <td></td>
            <td className="w-32 p-2 text-left">Index</td>
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              return (
              <td
                key={`${selectedChain}-id-${index}`}
                className={
                  "w-12 p-2 text-center even:bg-gray-50"
                }
              >
                {nucleotide ? nucleotide.original_index : column.label}
              </td>
            )})}
          </tr>
          <tr>
            <td></td>
            <td className="w-32 p-2 text-left">Residue</td>
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              return (
              <td
                key={`${selectedChain}-name-${index}`}
                className={
                  "w-12 p-2 text-center even:bg-gray-50"
                }
              >
                {nucleotide ? nucleotide.base : ""}
              </td>
            )})}
          </tr>
          <tr>
            <td></td>
            <td className="w-32 p-2 text-left">
              Secondary Structure
            </td>
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              return (
              <td
                key={`${selectedChain}-index-${index}`}
                className={
                  "w-12 p-2 text-center even:bg-gray-50"
                }
              >
                {nucleotide ? nucleotide.structure : ""}
              </td>
            )})}
          </tr>
          <tr>
            <td></td>
            <td className="w-32 p-2 text-left">
              Structural Element
            </td>
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              return (
              <td
                key={`${selectedChain}-struct-${index}`}
                className={
                  "w-12 p-2 text-center even:bg-gray-50"
                }
              >
                {nucleotide && nucleotide.structuralElements && nucleotide.structuralElements.length > 0
                  ? nucleotide.structuralElements
                      .map((el) => el.name)
                      .filter(Boolean)
                      .join(", ")
                  : ""}
              </td>
            )})}
          </tr>
          { analyzeNeighborhood && (
          <tr>
            <td className="w-12 p-2 text-center">
              <input
                type="radio"
                name="metric-selector"
                checked={effectiveSelectedScore === QualityScore.CLASH_SCORE}
                onChange={() => handleClick(QualityScore.CLASH_SCORE)}
                className="cursor-pointer"
              />
            </td>
            <td
            id="tableClashscore"
            className="w-32 p-2 text-left cursor-pointer"
            onClick={(_) => handleClick(QualityScore.CLASH_SCORE)}
            style={{
              borderWidth: "3px",
              borderColor:
                effectiveSelectedScore === QualityScore.CLASH_SCORE
                  ? selectedBorderColor
                  : "#ffffff",
            }}
            >
              Clashscore
            </td>
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              return (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide ? nucleotide.residue_number : undefined}
                className={
                  "w-12 p-2 text-center column-CLASH_SCORE even:bg-gray-50"
                }
                style={activeCellStyle(column, QualityScore.CLASH_SCORE)}
              >
                {nucleotide && nucleotide.metrics ? nucleotide.metrics.clashscore : 
                  !shouldHideSpinners && nucleotide && nucleotide.selected ? (
                    <span className="inline-block align-middle">
                      <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500"></span>
                    </span>
                  ) : ""}
              </td>
            )})}
          </tr>)}
          {analyzeNeighborhood && (
          <tr>
            <td className="w-12 p-2 text-center">
              <input
                type="radio"
                name="metric-selector"
                checked={effectiveSelectedScore === QualityScore.BAD_BONDS}
                onChange={() => handleClick(QualityScore.BAD_BONDS)}
                className="cursor-pointer"
              />
            </td>
            <td 
            id="tableBadBonds"
            className="w-32 p-2 text-left cursor-pointer"
            onClick={(_) => handleClick(QualityScore.BAD_BONDS)}
            style={{
              borderWidth: "3px",
              borderColor:
                effectiveSelectedScore === QualityScore.BAD_BONDS
                  ? selectedBorderColor
                  : "#ffffff",
            }}
            >
              Bad Bonds
            </td>
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              return (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide ? nucleotide.residue_number : undefined}
                className={
                  "w-12 p-2 text-center column-BAD_BONDS even:bg-gray-50"
                }
                style={activeCellStyle(column, QualityScore.BAD_BONDS)}
              >
                {nucleotide && nucleotide.metrics 
                ? `${nucleotide.metrics.numbadbonds} / ${nucleotide.metrics.numbonds} (${nucleotide.metrics.pct_badbonds}%)`
                : 
                  !shouldHideSpinners && nucleotide && nucleotide.selected ? (
                    <span className="inline-block align-middle">
                      <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500"></span>
                    </span>
                  ) : ""}
              </td>
            )})}
          </tr>)}
          {analyzeNeighborhood && (
          <tr>
            <td className="w-12 p-2 text-center">
              <input
                type="radio"
                name="metric-selector"
                checked={effectiveSelectedScore === QualityScore.BAD_ANGLES}
                onChange={() => handleClick(QualityScore.BAD_ANGLES)}
                className="cursor-pointer"
              />
            </td>
            <td 
            id="tableBadAngles"
            className="w-32 p-2 text-left cursor-pointer"
            onClick={(_) => handleClick(QualityScore.BAD_ANGLES)}
            style={{
              borderWidth: "3px",
              borderColor:
                effectiveSelectedScore === QualityScore.BAD_ANGLES
                  ? selectedBorderColor
                  : "#ffffff",
            }}
            >
              Bad Angles
            </td>
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              return (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide ? nucleotide.residue_number : undefined}
                className={
                  "w-12 p-2 text-center column-BAD_ANGLES even:bg-gray-50"
                }
                style={activeCellStyle(column, QualityScore.BAD_ANGLES)}
              >
                {nucleotide && nucleotide.metrics 
                ? `${nucleotide.metrics.numbadangles} / ${nucleotide.metrics.numangles} (${nucleotide.metrics.pct_badangles}%)`
                : 
                  !shouldHideSpinners && nucleotide && nucleotide.selected ? (
                    <span className="inline-block align-middle">
                      <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500"></span>
                    </span>
                  ) : ""}
              </td>
            )})}
          </tr>)}
          <tr>
            <td className="w-12 p-2 text-center">
              <input
                type="radio"
                name="metric-selector"
                checked={effectiveSelectedScore === QualityScore.SUITENESS}
                onChange={() => handleClick(QualityScore.SUITENESS)}
                className="cursor-pointer"
              />
            </td>
            <td 
            id="tableSuiteness"
            className="w-32 p-2 text-left cursor-pointer"
            onClick={(_) => handleClick(QualityScore.SUITENESS)}
            style={{
              borderWidth: "3px",
              borderColor:
                effectiveSelectedScore === QualityScore.SUITENESS
                  ? selectedBorderColor
                  : "#ffffff",
            }}
            >
              Suiteness
            </td>
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              return (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide ? nucleotide.residue_number : undefined}
                className={
                  "w-12 p-2 text-center column-SUITENESS even:bg-gray-50"
                }
                style={activeCellStyle(column, QualityScore.SUITENESS)}
              >
                {nucleotide && nucleotide.residueMetrics ? nucleotide.residueMetrics.suiteness : ""}
              </td>
            )})}
          </tr>
          <tr>
            <td className="w-12 p-2 text-center">
              <input
                type="radio"
                name="metric-selector"
                checked={effectiveSelectedScore === QualityScore.SUGAR_PUCKER_OUT}
                onChange={() => handleClick(QualityScore.SUGAR_PUCKER_OUT)}
                className="cursor-pointer"
              />
            </td>
            <td 
            id="tableSugarPuckerOut"
            className="w-32 p-2 text-left cursor-pointer"
            onClick={(_) => handleClick(QualityScore.SUGAR_PUCKER_OUT)}
            style={{
              borderWidth: "3px",
              borderColor:
                effectiveSelectedScore === QualityScore.SUGAR_PUCKER_OUT
                  ? selectedBorderColor
                  : "#ffffff",
            }}
            >
              Sugar Pucker Outlier
            </td>
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              return (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide ? nucleotide.residue_number : undefined}
                className={
                  "w-12 p-2 text-center  column-SUGAR_PUCKER_OUT even:bg-gray-50"
                }
                style={activeCellStyle(column, QualityScore.SUGAR_PUCKER_OUT)}
              >
                {nucleotide && nucleotide.residueMetrics?.pucker_outlier_type ? nucleotide.residueMetrics.pucker_outlier_type : ""}
              </td>
            )})}
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
