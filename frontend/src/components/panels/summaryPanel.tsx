import React, {useEffect, useState} from "react";
import {useParams} from "react-router-dom";
import Loading from "../common/loading";
import "../../App.css";
import Molstar from "../visualizations/molStarSummaryComponent";
import FornacSummaryComponent from "../visualizations/fornaSummaryComponent";
import {Annotation, Chain, Nucleotide, Numeration} from "../utils/types";
import {Colors} from "../common/colors";
import DownloadLink from "../common/downloadLink";
import DownloadFile from "../common/downloadFile";
import ErrorPage, {ErrorPageProps} from "../common/ErrorPage";
import JobProcessing from "../common/JobProcessing";
import {getColor, rangeMap} from "../utils/ColorUtils";
import VerticalColorBar from "../visualizations/VerticalColorBar";

export type Residue = {
    residue_number: number;
    metrics: Metrics;
};

export interface Job {
    id: number;
    originalfilename: string;
    name: string;
    createdat: string;
    updatedat: string;
    annotation: Annotation[];
    metadata: Metadata;
    numeration: Numeration;
    results: {
        mode: string;
        data: Residue[];
    }
    pdb_file_string: string;
}

interface Metadata {
    status: string;
}

interface Metrics {
    clashscore: string;
    numbadbonds: string;
    pct_badbonds: string;
    numbadangles: string;
    pct_badangles: string;
}

function transformJobToChains(job: Job): Chain[] {
    const chains: Chain[] = [];

    let startIndex = Math.min(
        ...Object.values(job.numeration).map((entry) => entry[0])
    );

    // Iterate over each annotation to create a Chain object
    job.annotation.forEach((annotation) => {
        console.log("START INDEX = ", startIndex);
        const chain: Chain = {
            name: annotation.name,
            sequence: annotation.sequnece,
            dotBracket: annotation.dotbracket,
            nucleotides: [],
        };

        // Iterate over the sequence and dotBracket to build Nucleotides
        console.log(
            annotation.name,
            annotation.sequnece,
            annotation.sequnece.length
        );
        for (let i = 0; i < annotation.sequnece.length; i++) {
            const numerationKey = Object.keys(job.numeration).find(
                (key) =>
                    job.numeration[key][0] === startIndex + i &&
                    job.numeration[key][1] === annotation.name.slice(-1)
            );
            // console.log(numerationKey, )
            if (numerationKey) {
                const nucleotide: Nucleotide = {
                    index: parseInt(numerationKey),
                    original_index: job.numeration[numerationKey][0],
                    base: annotation.sequnece[i],
                    structure: annotation.dotbracket[i],
                    selected: false,
                };
                chain.nucleotides.push(nucleotide);
            }
        }
        startIndex += annotation.sequnece.length;

        chains.push(chain);
        console.log(
            "CHAIN Z PANELU:",
            chain.name,
            chain.sequence,
            chain.nucleotides
        );
    });

    return chains;
}

export enum QualityScore {
    CLASH_SCORE = "Clash Score",
    BAD_ANGLES = "Bad Angles",
    BAD_BONDS = "Bad Bonds",
}

// Inside your component render return statement


async function fetchMyData(jobID: string | undefined) {
    console.log(`Sending request to /api/v1/jobs/${jobID}`);
    const response = await fetch(`http://localhost:3000/api/v1/jobs/${jobID}`, {
        signal: AbortSignal.timeout(5000),
    });
    console.log("Fetch data response: " + response.status);
    return response;
}


export const clashScoreColorMap = new Map<number, string>()
export const badAnglesColorMap = new Map<number, string>()
export const badBonesColorMap = new Map<number, string>()


const SummaryPanel: React.FC = () => {
    const {jobId} = useParams();
    const [myData, setMyData] = useState<Job>();
    const [myError, setMyError] = useState<ErrorPageProps | null>(null);
    const [labelInterval] = useState(10);
    const [numbering] = useState(true);
    const [nodeOutline] = useState(true);
    const [nodeLabel] = useState(true);
    const [links] = useState(true);
    const [directionArrows] = useState(true);
    const [is3Dview, setIs3Dview] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [selectedQualityScore, setQualityScore] = useState<QualityScore>(QualityScore.CLASH_SCORE);
    const [chainsState, setChainsState] = useState<Chain[]>([]);

    const devColor = "#f3f4f6";
    const selectedColor = "#C6C4C4FF";

    const colorGnodes = () => {
        if (!myData || !myData.results || !myData.results.data) {
            console.warn("Brak danych w myData.results.data");
            return <ErrorPage/>
        }
        if (myData.results.mode === "fragment") {
            //@ts-ignore
            const nodes = d3.selectAll("circle.fornac-node");
            nodes.style("fill", "white");
        }
        myData.results.data.forEach((residue) => {
            try {
                //@ts-ignore
                const node = d3.select(`circle.fornac-node[node_num="${residue.residue_number}"]`);
                if (!node.empty() && myData.results.mode === "full") {
                    node.classed("fornac-selectedNode", true) // Dodanie/ustawienie klasy np. dla wybranego
                        .style("fill", getColor(residue, selectedQualityScore)); // Zmiana koloru wypełnienia węzła
                } else if (!node.empty() && myData.results.mode === "fragment") {
                    //@ts-ignore

                    node.classed("fornac-selectedNode", true) // Dodanie/ustawienie klasy np. dla wybranego
                        .style("fill", "lightblue"); // Zmiana koloru wypełnienia węzła
                } else {
                    console.warn(`Node with index ${residue.residue_number} not found`);
                }
            } catch (error) {
                console.error("Failed to select node:", error);
            }
        });
    };

    const getColorMap = () => {
        if (!myData || !myData.results || !myData.results.data) {
            console.error("Brak danych w myData.results.data");
            return <ErrorPage/>
        }

        myData.results.data.forEach((residue) => {
            var color = getColor(residue, QualityScore.CLASH_SCORE); // Uzyskaj kolor za pomocą getColor
            clashScoreColorMap.set(residue.residue_number, color);
            color = getColor(residue, QualityScore.BAD_ANGLES)
            badAnglesColorMap.set(residue.residue_number, color);
            color = getColor(residue, QualityScore.BAD_BONDS)
            badBonesColorMap.set(residue.residue_number, color);
        });
    };

    function toggle() {
        setIs3Dview((is3Dview) => {
            is3Dview = !is3Dview;
            console.log(is3Dview);
            let switchViewButton = document.getElementById(
                "switchViewButton"
            ) as HTMLElement;
            if (is3Dview) {
                switchViewButton.textContent = "Switch to 2D view";
            } else {
                switchViewButton.textContent = "Switch to 3D view";
            }
            return is3Dview;
        });
    }

    const toggleVisibility = () => {
        setShowMenu((prevShowMenu) => !prevShowMenu);
    };


    useEffect(() => {
        if (!is3Dview) {
            console.log("FornacComponent has been rendered!");
            colorGnodes(); // Wywołanie funkcji
        }
    }, [is3Dview]);

    useEffect(() => {
        let interval: NodeJS.Timeout; // Declare interval variable
        async function fetchData() {
            console.log("Start to fetch data");
            try {
                const response = await fetchMyData(jobId);
                const data = await response.json();
                if (!response.ok) {
                    console.log(
                        `Error during fetching data. Message: ${data.error} Status code: ${response.status}`
                    );
                    setMyError({
                        errorMessage: data.error,
                        statusCode: response.status.toString(),
                    });
                } else {
                    setMyData(data);
                    const chains = transformJobToChains(data);
                    setChainsState(chains);
                    console.log("data:", data);

                    if (data.metadata.status === "completed" || data.metadata.status === "running") {
                        clearInterval(interval); // Stop the interval loop
                        setIsLoading(false);    // Set loading to false
                    }
                }
            } catch (error) {
                console.error("Failed to fetch data:", error);
                setMyError({
                    errorMessage: "Failed to fetch data",
                    statusCode: "500",
                });
            }
        }

        // Set up interval to poll fetchData
        interval = setInterval(fetchData, 3000); // Retry every 3 seconds

        // Cleanup interval when component unmounts or jobId changes
        return () => clearInterval(interval);
    }, [jobId]);


    if (isLoading) {
        return <Loading/>;
    }

    if (myError) {
        var message = myError.errorMessage;
        var code = myError.statusCode;
        return <ErrorPage errorMessage={message} statusCode={code}/>;
    }

    if (!myData) {
        return <ErrorPage/>;
    }

    if (myData.metadata.status !== "completed") {
        return <JobProcessing/>;
    }

    function makeTable(myData: Job) {
        const indices: string[] = [];
        const original_indices: number[] = [];

        const handleClick = (selectedScore: QualityScore, event: React.MouseEvent<HTMLTableHeaderCellElement>) => {
            setQualityScore(selectedScore)

            let tableClashscore = document.getElementById("tableClashscore") as HTMLElement;
            let tableBadAngles = document.getElementById("tableBadAngles") as HTMLElement;
            let tableBadBonds = document.getElementById("tableBadBonds") as HTMLElement;
            tableClashscore.style.backgroundColor = devColor;
            tableBadAngles.style.backgroundColor = devColor;
            tableBadBonds.style.backgroundColor = devColor;

            if (selectedScore === QualityScore.CLASH_SCORE) {
                tableClashscore.style.backgroundColor = selectedColor;
            } else if (selectedScore === QualityScore.BAD_ANGLES) {
                tableBadAngles.style.backgroundColor = selectedColor;
            } else {
                tableBadBonds.style.backgroundColor = selectedColor;
            }

        };

        myData.results.data.forEach((residue) => {
            if (residue && typeof residue.residue_number === "number") {
                indices.push(residue.residue_number.toString());
            } else {
                console.warn("Unexpected residue format:", residue);
            }
        });

        indices.forEach((index) => {
            original_indices.push(myData.numeration[index]?.[0]);
        });

        if (myData.results.mode === "fragment") {
            const clashscore = myData.results.data?.[0].metrics.clashscore;
            const numbadangles = myData.results.data?.[0].metrics.numbadangles;
            const numbadbonds = myData.results.data?.[0].metrics.numbadbonds
            return (
                <div className="max-h-[60vh] overflow-y-auto">
                    <table>
                        <tbody className="w-full">
                        <tr>
                            <th className="border border-neutral-300 bg-gray-100 w-[70%] p-3 text-2xl font-semibold">
                                Residue numbers range
                            </th>
                            <td className="border border-neutral-300 bg-gray-100 w-[30%] text-2xl text-center">
                                {original_indices[0]} -{" "}
                                {original_indices[original_indices.length - 1]}
                            </td>
                        </tr>
                        <tr>
                            <th className="border border-neutral-300 bg-white p-3 text-2xl font-semibold">
                                Clashscore
                            </th>
                            <td className="border border-neutral-300 bg-white text-2xl text-center">
                                {clashscore}
                            </td>
                        </tr>
                        <tr>
                            <th className="border border-neutral-300 bg-gray-100 p-3 text-2xl font-semibold">
                                Bad angles
                            </th>
                            <td className="border border-neutral-300 bg-gray-100 text-2xl text-center">
                                {numbadangles}
                            </td>
                        </tr>
                        <tr>
                            <th className="border border-neutral-300 bg-white p-3 text-2xl font-semibold">
                                Bad bonds
                            </th>
                            <td className="border border-neutral-300 bg-white text-2xl text-center">
                                {numbadbonds}
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            );
        } else if (myData.results.mode === "full") {
            return <table className="text-center min-w-full text-wrap">
                <thead className="sticky top-0 z-10">
                <tr className="bg-gray-100 font-semibold">
                    <th className="border border-neutral-300 text-center py-2 px-1">
                        <div className="text-sm whitespace-normal">Residue Numbers</div>
                    </th>
                    <th id="tableClashscore" className="border border-neutral-300 cursor-pointer text-center py-2 px-1"
                        style={{backgroundColor: selectedColor}}
                        onClick={(event) => handleClick(QualityScore.CLASH_SCORE, event)}>
                        <div className="text-sm whitespace-normal">Clashscore</div>
                    </th>
                    <th id="tableBadAngles" className="border border-neutral-300 cursor-pointer text-center py-2 px-1"
                        onClick={(event) => handleClick(QualityScore.BAD_ANGLES, event)}>
                        <div className="text-sm whitespace-normal">Bad Angles</div>
                    </th>
                    <th id="tableBadBonds" className="border border-neutral-300 cursor-pointer text-center py-2 px-1"
                        onClick={(event) => handleClick(QualityScore.BAD_BONDS, event)}>
                        <div className="text-sm whitespace-normal">Bad Bonds</div>
                    </th>
                </tr>
                </thead>
                <tbody>
                {myData.results.data.map((residue, index) => (
                    <tr key={residue.residue_number}
                        className={residue.residue_number % 2 === 0 ? "bg-gray-100" : "bg-white"}>
                        <td className="border border-neutral-300">{original_indices[index]}</td>
                        <td className="border border-neutral-300">{residue.metrics.clashscore}</td>
                        <td className="border border-neutral-300">{residue.metrics.pct_badangles}</td>
                        <td className="border border-neutral-300">{residue.metrics.pct_badbonds}</td>
                    </tr>
                ))}
                </tbody>
            </table>
        } else {
            return <ErrorPage/>;
        }
    }

    function createRangeMenu() {
        return (
            <div>
                {Array.from(rangeMap).map(([key, value]) => (
                    <div>
                        <h2><b> {key} </b></h2>
                        <div className="ml-4">
                            {value.ranges.map((range, index) => (
                                <div key={index} className="mb-1">
                                    <span className="font-bold">{index + 1} -</span>{" "}
                                    {range[0]} &lt; {key}{" "} {range[1] !== Infinity ? `< ${range[1]}` : ""}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>);
    }


    return (
        <div className="flex flex-col h-screen w-screen">
            <div className="flex w-full">
                <div className="flex flex-row text-3xl font-medium items-center self-start p-[30px]">
                    <div className="flex flex-col">
                        <div className="font-extrabold">
                            <h1>RNA</h1>
                        </div>
                        <div className="font-semibold pr-5 text-{#526969}">
                            <h1 style={{color: Colors.blue}}>MOLEY</h1>
                        </div>
                    </div>
                    <h1>| Result Panel</h1>
                </div>
                <div className="flex justify-center items-center ml-auto h-full">
                    <button
                        id="switchViewButton"
                        onClick={toggle}
                        className="font-bold rounded-lg p-4 text-2xl text-black flex justify-center items-center my-1 mr-[30px] transition-colors bg-rose-400/80 hover:bg-sky-400 w-auto"
                        style={{backgroundColor: Colors.salmon}}
                    >
                        Switch to 3D view
                    </button>
                </div>
            </div>
            <div className="flex flex-wrap w-full h-full rounded-lg">
                <div className="flex flex-col h-full max-h-full items-center p-9 rounded-lg"
                     style={{backgroundColor: Colors.backgroundBlue}}>
                    <div className="min-h-[12rem] max-h-[50vh] overflow-y-auto table-fixed mb-3">
                        {makeTable(myData)}
                    </div>
                    <DownloadLink/>
                    <DownloadFile id={jobId}/>
                </div>
                <div className="flex flex-grow bg-white">
                    <div className="relative w-full h-full border-2 rounded-lg"
                         style={{borderColor: Colors.backgroundBlue}}>
                        {myData.results.mode === "full" &&
                            <div className="z-40 absolute bottom-2 left-2  bg-white">
                                {!showMenu && (
                                    <div>
                                        <button
                                            id="menuButton"
                                            onClick={toggleVisibility}
                                            className="w-full mt-0 inline-block rounded bg-neutral-300 px-6 text-sm font-medium uppercase leading-normal text-neutral-900 shadow-light-3 transition duration-150 ease-in-out hover:bg-neutral-600 hover:text-white hover:shadow-light-2 focus:bg-neutral-200 focus:shadow-light-2 focus:outline-none focus:ring-0 active:bg-neutral-200 active:shadow-light-2 motion-reduce:transition-none dark:shadow-black/30 dark:hover:shadow-dark-strong dark:focus:shadow-dark-strong dark:active:shadow-dark-strong">
                                            Show range details
                                        </button>
                                    </div>)}
                                {showMenu && (
                                    <div>
                                        <button
                                            id="menuButton"
                                            onClick={toggleVisibility}
                                            className="w-full mt-0 inline-block rounded bg-neutral-300 px-6 text-sm font-medium uppercase leading-normal text-neutral-900 shadow-light-3 transition duration-150 ease-in-out hover:bg-neutral-600 hover:text-white hover:shadow-light-2 focus:bg-neutral-200 focus:shadow-light-2 focus:outline-none focus:ring-0 active:bg-neutral-200 active:shadow-light-2 motion-reduce:transition-none dark:shadow-black/30 dark:hover:shadow-dark-strong dark:focus:shadow-dark-strong dark:active:shadow-dark-strong">
                                            Close
                                        </button>
                                        <div className="flex flex-col max-h-[50vh] overflow-y-auto p-2">
                                            {createRangeMenu()}
                                        </div>
                                    </div>)}

                            </div>}
                        <div style={{display: is3Dview ? "none" : "block"}}
                             className="absolute h-full w-full">
                            <FornacSummaryComponent
                                structures={myData.annotation.map((a) => a.dotbracket)}
                                sequences={myData.annotation.map((a) => a.sequnece)}
                                chains={chainsState}
                                setChains={setChainsState}
                                labelInterval={labelInterval}
                                numbering={numbering}
                                nodeOutline={nodeOutline}
                                nodeLabel={nodeLabel}
                                links={links}
                                directionArrows={directionArrows}
                                setAnimation={false}
                                job={myData}
                            />
                            {colorGnodes()}
                        </div>
                        <div style={{display: is3Dview ? "block" : "none"}}
                             className="absolute h-full w-full">
                            {getColorMap()}
                            <Molstar
                                useInterface={true}
                                file={myData.pdb_file_string}
                                chains={chainsState}
                                setChains={setChainsState}
                                initialized={initialized}
                                setInitialized={setInitialized}
                                is3dEnabled={is3Dview}
                            />
                        </div>
                    </div>
                    {myData.results.mode === "full" && <VerticalColorBar/>}
                </div>
            </div>
        </div>
    );
};

export default SummaryPanel;
