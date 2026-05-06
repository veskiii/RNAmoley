import { QualityScore, Residue } from "./types";

export const colorMapByRange: Map<number, string> = new Map([
  [1, "#50982d"],
  [2, "#8DC641"],
  [3, "#ede468"],
  [4, "#ed6f32"],
  [5, "#dd2e35"],
]);

interface Range {
  ranges: [number, number][]; // Array of tuples
}

export const rangeMap: Map<String, Range> = new Map([
  [
    "Clash Score",
    {
      ranges: [
        [0, 10],
        [10, 40],
        [40, 70],
        [70, 100],
        [100, Infinity],
      ],
    },
  ],
  [
    "Suiteness",
    {
      ranges: [
        [0, 0.01],
        [0.01, 0.3],
        [0.3, 0.7],
        [0.7, 0.9],
        [0.9, 1],
      ],
    },
  ],
  [
    "Bad Angles",
    {
      ranges: [
        [0, 0.01],
        [0.01, 2],
        [2, 100],
      ],
    },
  ],
  [
    "Bad Bonds",
    {
      ranges: [
        [0, 0.01],
        [0.01, 2],
        [2, 100],
      ],
    },
  ],
]);

function getRange(residue: Residue, givenQualityScore: QualityScore): number {
  if (givenQualityScore === QualityScore.BAD_BONDS) {
    if(!residue.metrics) return 0;
    var qualityScore = parseFloat(residue.metrics.pct_badbonds);
    var range = rangeMap.get("Bad Bonds");
    const ranges = range?.ranges ?? [];
    // @ts-ignore
    if (qualityScore < ranges[0][1]) {
      return 1;
      // @ts-ignore
    } else if (qualityScore >= ranges[1][0] && qualityScore < ranges[1][1]) {
      return 3;
      // @ts-ignore
    } else {
      return 5;
    }
  } else if (givenQualityScore == QualityScore.BAD_ANGLES) {
    if(!residue.metrics) return 0;
    var qualityScore = parseFloat(residue.metrics.pct_badangles);
    var range = rangeMap.get("Bad Angles");
    const ranges = range?.ranges ?? [];
    // @ts-ignore
    if (qualityScore < ranges[0][1]) {
      return 1;
      // @ts-ignore
    } else if (qualityScore >= ranges[1][0] && qualityScore < ranges[1][1]) {
      return 3;
      // @ts-ignore
    } else {
      return 5;
    }
  } else if (givenQualityScore == QualityScore.CLASH_SCORE) {
    if(!residue.metrics) return 0;
    var qualityScore = parseFloat(residue.metrics.clashscore);
    var range = rangeMap.get("Clash Score");
    const ranges = range?.ranges ?? [];
    // @ts-ignore
    if (qualityScore < ranges[0][1]) {
      return 1;
      // @ts-ignore
    } else if (qualityScore >= ranges[1][0] && qualityScore < ranges[1][1]) {
      return 2;
      // @ts-ignore
    } else if (qualityScore >= ranges[2][0] && qualityScore < ranges[2][1]) {
      return 3;
      // @ts-ignore
    } else if (qualityScore >= ranges[3][0] && qualityScore < ranges[3][1]) {
      return 4;
    } else {
      return 5;
    }
  } else if (givenQualityScore == QualityScore.SUITENESS) {
    if(!residue.residueMetrics) return 0;
    var qualityScore = parseFloat(residue.residueMetrics.suiteness);
    var range = rangeMap.get("Suiteness");
    const ranges = range?.ranges ?? [];
    // @ts-ignore
    if (qualityScore < ranges[0][1]) {
      return 5;
      // @ts-ignore
    } else if (qualityScore >= ranges[1][0] && qualityScore < ranges[1][1]) {
      return 4;
      // @ts-ignore
    } else if (qualityScore >= ranges[2][0] && qualityScore < ranges[2][1]) {
      return 3;
      // @ts-ignore
    } else if (qualityScore >= ranges[3][0] && qualityScore < ranges[3][1]) {
      return 2;
    } else {
      return 1;
    }
  } else if (givenQualityScore == QualityScore.SUGAR_PUCKER_OUT) {
    if(!residue.residueMetrics) return 0;
    var sugarPuckerOutlierType = residue.residueMetrics.pucker_outlier_type;
    if (sugarPuckerOutlierType === "") {
      return 1;
    } else {
      return 5;
    }
  }
  return 0;
}

export function getColor(residue: Residue, qualityScore: QualityScore): string {
  var n = getRange(residue, qualityScore);
  return colorMapByRange.get(n) || "#ffffff";
}
