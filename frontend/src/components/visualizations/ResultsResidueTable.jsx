import React, { useEffect, useMemo } from "react";
import { QualityScore } from "../utils/types";
import { getColor } from "../utils/ColorUtils";
import { Colors } from "../common/colors";

const ResultsResidueTable = ({ data, simData, analyzeNeighborhood, selectedScore, setSelectedScore, modelStatus, selectedChain }) => {
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

  const replaceGreekLetterNames = (text) => {
    if (text === null || text === undefined) {
      return "";
    }

    const greekLetterMap = {
      delta: "δ",
      epsilon: "ε",
      zeta: "ζ",
      chi: "χ",
    };

    return String(text).replace(
      /\b(delta|epsilon|zeta|chi)\b/gi,
      (match) => greekLetterMap[match.toLowerCase()] || match,
    );
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

    // build map of simData entries keyed by chain-original_index
    const simMap = new Map();
    if (simData && Array.isArray(simData)) {
      simData.forEach((s) => {
        const chainKey = s.chainID ?? s.chainId ?? s.chain;
        const idx = s.original_index ?? s.residue_number ?? s.index ?? s.residueIndex;
        if (chainKey != null && idx != null) {
          const key = `${chainKey}-${String(idx)}`;
          if (!simMap.has(key)) simMap.set(key, []);
          simMap.get(key).push(s);
        }
      });
    }

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

      const nucleotideKey = `${nucleotide.chainID}-${String(nucleotide.original_index ?? nucleotide.residue_number ?? nucleotide.index ?? "")}`;
      const simForNucleotide = simMap.get(nucleotideKey) || undefined;

      if (nucleotide.selected) {
        columns.push({ type: "nucleotide", nucleotide: { ...nucleotide, simData: simForNucleotide } });
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

      // collect simData for the whole range
      const simRange = [];
      const startNum = Number(startIndex);
      const endNum = Number(endIndex);
      if (Number.isFinite(startNum) && Number.isFinite(endNum)) {
        for (let idx = startNum; idx <= endNum; idx += 1) {
          const key = `${selectedChain}-${String(idx)}`;
          const entries = simMap.get(key);
          if (entries) simRange.push(...entries);
        }
      }

      columns.push({
        type: "not-selected-range",
        startIndex,
        endIndex,
        label,
        simData: simRange.length > 0 ? simRange : undefined,
      });

      i = end;
    }

    return columns;
  }, [data, selectedChain, simData]);

  const hasSimRows = analyzeNeighborhood && tableColumns && tableColumns.some(col => (
    (col.type === 'nucleotide' && col.nucleotide && col.nucleotide.simData && col.nucleotide.simData.length > 0) ||
    (col.simData && col.simData.length > 0)
  ));

  const getColumnNucleotide = (column) => (column.type === "nucleotide" ? column.nucleotide : null);

  const activeCellStyle = (column, score, sim) => {
    let residue = getColumnNucleotide(column);
    if (!residue) {
      return undefined;
    }
    if (effectiveSelectedScore !== score) {
      return undefined;
    }
    if (sim) {
      const simEntries = residue.simData || column.simData;
      if (!simEntries || simEntries.length === 0) {
        return undefined;
      }
      const simScore = simEntries[0];
      if (!simScore) {
        return undefined;
      }
      residue = simScore;
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
            {/* <td></td> */}
            <td className="w-32 p-2 text-left">Index</td>
            {hasSimRows && <td></td>}
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
            {/* <td></td> */}
            <td className="w-32 p-2 text-left">Residue</td>
            {hasSimRows && <td></td>}
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
            {/* <td></td> */}
            <td className="w-32 p-2 text-left">
              Secondary structure
            </td>
            {hasSimRows && <td></td>}
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
          {/* <tr>
            <td></td>
            <td className="w-32 p-2 text-left">
              Structural Element
            </td>
            {hasSimRows && <td></td>}
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
          </tr> */}
          { analyzeNeighborhood && (
          <tr>
            {/* <td rowSpan={hasSimRows ? 2 : undefined} className="w-12 p-2 text-center">
              <input
                type="radio"
                name="metric-selector"
                checked={effectiveSelectedScore === QualityScore.CLASH_SCORE}
                onChange={() => handleClick(QualityScore.CLASH_SCORE)}
                className="cursor-pointer"
              />
            </td> */}
            <td
            id="tableClashscore"
            rowSpan={hasSimRows ? 2 : undefined}
            className="w-32 p-2 text-left"// cursor-pointer"
            // onClick={(_) => handleClick(QualityScore.CLASH_SCORE)}
            // style={{
            //   borderWidth: "3px",
            //   borderColor:
            //     effectiveSelectedScore === QualityScore.CLASH_SCORE
            //       ? selectedBorderColor
            //       : "#ffffff",
            // }}
            >
              Clash score
            </td>
            {hasSimRows && <td>Original</td>}
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              return (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide ? nucleotide.residue_number : undefined}
                className={
                  "w-12 p-2 text-center column-CLASH_SCORE even:bg-gray-50"
                }
                // style={activeCellStyle(column, QualityScore.CLASH_SCORE)}
              >
                {nucleotide && nucleotide.selected ? (
                  nucleotide.metrics
                    ? nucleotide.metrics.clashscore
                    : !shouldHideSpinners && nucleotide && nucleotide.selected ? (
                      <span className="inline-block align-middle">
                        <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500"></span>
                      </span>
                    ) : ""
                ) : "N/A"}
              </td>
            )})}
          </tr>)}
          { analyzeNeighborhood && hasSimRows && (
          <tr>
            <td>Refined</td>
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              const simEntries = nucleotide ? nucleotide.simData : column.simData;
              const value = simEntries && simEntries.length > 0 && simEntries[0].metrics !== undefined
                ? simEntries[0].metrics.clashscore
                : "N/A";
              return (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide ? nucleotide.residue_number : undefined}
                className={
                  "w-12 p-2 text-center column-CLASH_SCORE odd:bg-gray-50"
                }
                // style={activeCellStyle(column, QualityScore.CLASH_SCORE, true)}
              >
                {value}
              </td>
            )})}
          </tr>)}
          {analyzeNeighborhood && (
          <tr>
            {/* <td rowSpan={hasSimRows ? 2 : undefined} className="w-12 p-2 text-center">
              <input
                type="radio"
                name="metric-selector"
                checked={effectiveSelectedScore === QualityScore.BAD_BONDS}
                onChange={() => handleClick(QualityScore.BAD_BONDS)}
                className="cursor-pointer"
              />
            </td> */}
            <td 
            id="tableBadBonds"
            rowSpan={hasSimRows ? 2 : undefined}
            className="w-32 p-2 text-left"// cursor-pointer"
            // onClick={(_) => handleClick(QualityScore.BAD_BONDS)}
            // style={{
            //   borderWidth: "3px",
            //   borderColor:
            //     effectiveSelectedScore === QualityScore.BAD_BONDS
            //       ? selectedBorderColor
            //       : "#ffffff",
            // }}
            >
              Bad bonds
            </td>
            {hasSimRows && <td>Original</td>}
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              return (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide ? nucleotide.residue_number : undefined}
                className={
                  "w-12 p-2 text-center column-BAD_BONDS even:bg-gray-50"
                }
                // style={activeCellStyle(column, QualityScore.BAD_BONDS)}
              >
                {nucleotide && nucleotide.selected ? (nucleotide.metrics 
                ? `${nucleotide.metrics.numbadbonds} / ${nucleotide.metrics.numbonds} (${nucleotide.metrics.pct_badbonds}%)`
                : 
                  !shouldHideSpinners && nucleotide && nucleotide.selected ? (
                    <span className="inline-block align-middle">
                      <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500"></span>
                    </span>
                  ) : "") : "N/A"}
              </td>
            )})}
          </tr>)}
          { analyzeNeighborhood && hasSimRows && (
          <tr>
            <td>Refined</td>
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              const simEntries = nucleotide ? nucleotide.simData : column.simData;
              const value = simEntries && simEntries.length > 0 && simEntries[0].metrics !== undefined
                ? simEntries[0].metrics.numbadbonds + " / " + simEntries[0].metrics.numbonds + " (" + simEntries[0].metrics.pct_badbonds + "%)"
                : "N/A";
              return (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide ? nucleotide.residue_number : undefined}
                className={
                  "w-12 p-2 text-center column-BAD_BONDS odd:bg-gray-50"
                }
                // style={activeCellStyle(column, QualityScore.BAD_BONDS, true)}
              >
                {value}
              </td>
            )})}
          </tr>)}
          {analyzeNeighborhood && (
          <tr>
            {/* <td rowSpan={hasSimRows ? 2 : undefined} className="w-12 p-2 text-center">
              <input
                type="radio"
                name="metric-selector"
                checked={effectiveSelectedScore === QualityScore.BAD_ANGLES}
                onChange={() => handleClick(QualityScore.BAD_ANGLES)}
                className="cursor-pointer"
              />
            </td> */}
            <td 
            id="tableBadAngles"
            rowSpan={hasSimRows ? 2 : undefined}
            className="w-32 p-2 text-left"// cursor-pointer"
            // onClick={(_) => handleClick(QualityScore.BAD_ANGLES)}
            // style={{
            //   borderWidth: "3px",
            //   borderColor:
            //     effectiveSelectedScore === QualityScore.BAD_ANGLES
            //       ? selectedBorderColor
            //       : "#ffffff",
            // }}
            >
              Bad angles
            </td>
            {hasSimRows && <td>Original</td>}
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              return (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide ? nucleotide.residue_number : undefined}
                className={
                  "w-12 p-2 text-center column-BAD_ANGLES even:bg-gray-50"
                }
                // style={activeCellStyle(column, QualityScore.BAD_ANGLES)}
              >
                {nucleotide && nucleotide.selected ? (nucleotide.metrics 
                ? `${nucleotide.metrics.numbadangles} / ${nucleotide.metrics.numangles} (${nucleotide.metrics.pct_badangles}%)`
                : 
                  !shouldHideSpinners && nucleotide && nucleotide.selected ? (
                    <span className="inline-block align-middle">
                      <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-500"></span>
                    </span>
                  ) : "") : "N/A"}
              </td>
            )})}
          </tr>)}
          { analyzeNeighborhood && hasSimRows && (
          <tr>
            <td>Refined</td>
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              const simEntries = nucleotide ? nucleotide.simData : column.simData;
              const value = simEntries && simEntries.length > 0 && simEntries[0].metrics !== undefined
                ? simEntries[0].metrics.numbadangles + " / " + simEntries[0].metrics.numangles + " (" + simEntries[0].metrics.pct_badangles + "%)"
                : "N/A";
              return (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide ? nucleotide.residue_number : undefined}
                className={
                  "w-12 p-2 text-center column-BAD_ANGLES odd:bg-gray-50"
                }
                // style={activeCellStyle(column, QualityScore.BAD_ANGLES, true)}
              >
                {value}
              </td>
            )})}
          </tr>)}
          <tr>
            {/* <td rowSpan={hasSimRows ? 2 : undefined} className="w-12 p-2 text-center">
              <input
                type="radio"
                name="metric-selector"
                checked={effectiveSelectedScore === QualityScore.SUITENESS}
                onChange={() => handleClick(QualityScore.SUITENESS)}
                className="cursor-pointer"
              />
            </td> */}
            <td 
            id="tableSuiteness"
            rowSpan={hasSimRows ? 2 : undefined}
            className="w-32 p-2 text-left"// cursor-pointer"
            // onClick={(_) => handleClick(QualityScore.SUITENESS)}
            // style={{
            //   borderWidth: "3px",
            //   borderColor:
            //     effectiveSelectedScore === QualityScore.SUITENESS
            //       ? selectedBorderColor
            //       : "#ffffff",
            // }}
            >
              Suiteness
            </td>
            {hasSimRows && <td>Original</td>}
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              return (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide ? nucleotide.residue_number : undefined}
                className={
                  "w-12 p-2 text-center column-SUITENESS even:bg-gray-50"
                }
                // style={activeCellStyle(column, QualityScore.SUITENESS)}
              >
                {nucleotide && nucleotide.selected ? (nucleotide.residueMetrics ? nucleotide.residueMetrics.suiteness : "") : "N/A"}
              </td>
            )})}
          </tr>
          {hasSimRows && <tr>
            <td>Refined</td>
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              const simEntries = nucleotide ? nucleotide.simData : column.simData;
              const value = simEntries && simEntries.length > 0 && simEntries[0].residueMetrics !== undefined
                ? simEntries[0].residueMetrics.suiteness
                : "N/A";
              return (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide ? nucleotide.residue_number : undefined}
                className={
                  "w-12 p-2 text-center column-SUITENESS odd:bg-gray-50"
                }
                // style={activeCellStyle(column, QualityScore.SUITENESS, true)}
              >
                {nucleotide && nucleotide.selected ? (value) : "N/A"}
              </td>
            )})}
          </tr>}
          <tr>
            {/* <td rowSpan={hasSimRows ? 2 : undefined} className="w-12 p-2 text-center">
              <input
                type="radio"
                name="metric-selector"
                checked={effectiveSelectedScore === QualityScore.SUGAR_PUCKER_OUT}
                onChange={() => handleClick(QualityScore.SUGAR_PUCKER_OUT)}
                className="cursor-pointer"
              />
            </td> */}
            <td 
            id="tableSugarPuckerOut"
            rowSpan={hasSimRows ? 2 : undefined}
            className="w-32 p-2 text-left"//</tr> cursor-pointer"
            // onClick={(_) => handleClick(QualityScore.SUGAR_PUCKER_OUT)}
            // style={{
            //   borderWidth: "3px",
            //   borderColor:
            //     effectiveSelectedScore === QualityScore.SUGAR_PUCKER_OUT
            //       ? selectedBorderColor
            //       : "#ffffff",
            // }}
            >
              Sugar pucker outlier
            </td>
            {hasSimRows && <td>Original</td>}
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              return (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide ? nucleotide.residue_number : undefined}
                className={
                  "w-12 p-2 text-center  column-SUGAR_PUCKER_OUT even:bg-gray-50"
                }
                // style={activeCellStyle(column, QualityScore.SUGAR_PUCKER_OUT)}
                title={nucleotide && nucleotide.residueMetrics && nucleotide.residueMetrics.pucker_outlier_type}
              >
                {nucleotide &&nucleotide.selected ? replaceGreekLetterNames(nucleotide?.residueMetrics?.pucker_outlier_type) || "-" : "N/A"}
              </td>
            )})}
          </tr>
          {hasSimRows && <tr>
            <td>Refined</td>
            {tableColumns.map((column, index) => {
              const nucleotide = getColumnNucleotide(column);
              const simEntries = nucleotide ? nucleotide.simData : column.simData;
              const value = simEntries && simEntries.length > 0 && simEntries[0].residueMetrics !== undefined
                ? simEntries[0].residueMetrics.pucker_outlier_type ? replaceGreekLetterNames(simEntries[0].residueMetrics.pucker_outlier_type) : "-"
                : "N/A";
              return (
              <td
                key={`${selectedChain}-struct-${index}`}
                data-residue-number={nucleotide ? nucleotide.residue_number : undefined}
                className={
                  "w-12 p-2 text-center column-SUGAR_PUCKER_OUT odd:bg-gray-50"
                }
                // style={activeCellStyle(column, QualityScore.SUGAR_PUCKER_OUT, true)}
              >
                {nucleotide && nucleotide.selected ? (value) : "N/A"}
              </td>
            )})}
          </tr>}
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
