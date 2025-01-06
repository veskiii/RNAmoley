import {QualityScore, Residue} from "../panels/summaryPanel";

export const colorMapByRange: Map<number, string> = new Map([
    [1, "#3fbf00"],
    [2, "#c0f149"],
    [3, "#E6DF00"],
    [4, "#E6A100"],
    [5, "#FF3636"],
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
        "Bad Bonds",
        {
            ranges: [
                [0, 1],
                [1, 2],
                [2, 3],
                [3, 5],
                [5, Infinity],
            ],
        },
    ],
    [
        "Bad Angles",
        {
            ranges: [
                [0, 2],
                [2, 3.5],
                [3.5, 5.5],
                [5.5, 7],
                [7, Infinity],
            ],
        },
    ],
]);

function getRange(residue: Residue, givenQualityScore: QualityScore): number {
    if (givenQualityScore === QualityScore.BAD_BONDS) {
        var qualityScore = parseFloat(residue.metrics.numbadbonds)
        var range = rangeMap.get("Bad Bonds")
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
    } else if (givenQualityScore == QualityScore.BAD_ANGLES) {
        var qualityScore = parseFloat(residue.metrics.numbadangles)
        var range = rangeMap.get("Bad Angles")

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
    return colorMapByRange.get(n) || "#3fbf00";
}