import {QualityScore, Residue} from "./types";

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
    ]
]);

function getRange(residue: Residue, givenQualityScore: QualityScore): number {
    if (givenQualityScore === QualityScore.BAD_BONDS) {
        var qualityScore = parseFloat(residue.metrics.pct_badbonds)
        if (qualityScore < 0.01) {
            return 1;
        }  else if(qualityScore >= 0.01 && qualityScore < 0.2) {
            return 3;
        }else{
            return 5;
        }
    } else if (givenQualityScore == QualityScore.BAD_ANGLES) {
        var qualityScore = parseFloat(residue.metrics.pct_badangles)
        if (qualityScore < 0.1) {
            return 1;
        }  else if(qualityScore >= 0.1 && qualityScore < 0.5) {
            return 3;
        }else{
            return 5;
        }
    } else {
        var qualityScore = parseFloat(residue.metrics.clashscore)
        var range = rangeMap.get("Clash Score")
            // @ts-ignore
        if (qualityScore < range?.ranges[0][1]) {
            return 1;
            // @ts-ignore
        } else if (qualityScore >= range?.ranges[1][0] && qualityScore < range?.ranges[1][1]) {
            return 2;
            // @ts-ignore
        } else if (qualityScore >= range?.ranges[2][0] && qualityScore < range?.ranges[2][1]) {
            return 3;
            // @ts-ignore
        } else if (qualityScore >= range?.ranges[3][0] && qualityScore < range?.ranges[3][1]) {
            return 4;
        } else {
            return 5;
        }
    }
}

export function getColor(residue: Residue, qualityScore: QualityScore): string {
    var n = getRange(residue, qualityScore)
    return colorMapByRange.get(n) || "#ffffff";
}