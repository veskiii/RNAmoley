import React, {useEffect, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import Loading from "../common/loading";
import "../../App.css";
import Molstar from "../visualizations/molStarSummaryComponent";
import FornacSummaryComponent from "../visualizations/fornaSummaryComponent";
import {badAnglesColorMap, badBondsColorMap, Chain, clashScoreColorMap, QualityScore, SummaryJob} from "../utils/types";
import {Colors} from "../common/colors";
import DownloadLink from "../common/downloadLink";
import DownloadFile from "../common/downloadFile";
import ErrorPage, {ErrorPageProps} from "../common/ErrorPage";
import {colorMapByRange, getColor} from "../utils/ColorUtils";
import JobProcessing from "../common/JobProcessing";
import HelpIcon from "../common/helpIcon";
import {transformJobToChains} from '../utils/transformJobToChains';
import {fetchMyData} from "../utils/api";
import Logo from "../common/logo";

const SummaryPanel: React.FC = () => {
    const {jobId} = useParams();
    const [myData, setMyData] = useState<SummaryJob>();
    const [myError, setMyError] = useState<ErrorPageProps | null>(null);
    const [labelInterval, setLabelInterval] = useState(10);
    const [numbering, setNumbering] = useState(true);
    const [nodeOutline, setNodeOutline] = useState(true);
    const [nodeLabel, setNodeLabel] = useState(true);
    const [links, setLinks] = useState(true);
    const [directionArrows, setDirectionArrows] = useState(false);
    const [animation, setAnimation] = useState(false);
    const [is3Dview, setIs3Dview] = useState(false);
    const [showRangeDetails, setshowRangeDetails] = useState(false);
    const [showDisplayOptions, setshowDisplayOptions] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [selectedQualityScore, setQualityScore] = useState<QualityScore>(QualityScore.CLASH_SCORE);
    const [chainsState, setChainsState] = useState<Chain[]>([]);
    const devColor = "#f3f4f6"
    const selectedBorderColor = Colors.salmon;
    const navigate = useNavigate();

    const colorGnodes = () => {
        if (!myData || !myData.results || !myData.results.data) {
            //console.warn("No data in myData.results.data");
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
                    node.classed("fornac-selectedNode", true)
                        .style("fill", getColor(residue, selectedQualityScore));
                } else if (!node.empty() && myData.results.mode === "fragment") {
                    //@ts-ignore

                    node.classed("fornac-selectedNode", true)
                        .style("fill", "#6fc2d3");
                } else {
                    console.warn(`Node with index ${residue.residue_number} not found`);
                }
            } catch (error) {
                console.error("Failed to select node:", error);
            }
        });
    };

    useEffect(() => {
        colorGnodes()
    }, [labelInterval, numbering, nodeOutline, nodeLabel, links, directionArrows, setAnimation]);

    const getColorMap = () => {
        if (!myData || !myData.results || !myData.results.data) {
            console.error("No data in myData.results.data");
            return <ErrorPage/>
        }

        myData.results.data.forEach((residue) => {
            var color = getColor(residue, QualityScore.CLASH_SCORE);
            clashScoreColorMap.set(residue.residue_number, color);
            color = getColor(residue, QualityScore.BAD_ANGLES)
            badAnglesColorMap.set(residue.residue_number, color);
            color = getColor(residue, QualityScore.BAD_BONDS)
            badBondsColorMap.set(residue.residue_number, color);
        });
    };

    function toggle() {
        setIs3Dview((is3Dview) => {
            is3Dview = !is3Dview;
            //console.log(is3Dview);
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

    function colorColumn(selectedScore: QualityScore = QualityScore.CLASH_SCORE) {
        const getEnumKeyByValue = (value: string): string | undefined => {
            return Object.keys(QualityScore).find(
                (key) => QualityScore[key as keyof typeof QualityScore] === value
            );
        };

        const score = getEnumKeyByValue(selectedScore);

        if (myData) {
            document.querySelectorAll(`td[class*="column-${score}"]`).forEach((cell, index) => {
                const residue = myData.results.data[index];
                if (residue) {
                    (cell as HTMLElement).style.backgroundColor = getColor(residue, selectedScore);
                }
            });
        }
        return <div></div>
    }

    const resetColumns = () => {
        ["CLASH_SCORE", "BAD_ANGLES", "BAD_BONDS"].forEach((column) => {
            document.querySelectorAll(`.column-${column}`).forEach((cell, index) => {
                const isRowEven = index % 2 === 0;
                (cell as HTMLElement).style.backgroundColor = isRowEven ? "#ffffff" : "#f3f4f6";
            });
        });
    };

    const handleClick = (selectedScore: QualityScore, event?: React.MouseEvent<HTMLTableHeaderCellElement>) => {
        setQualityScore(selectedScore);
        resetColumns();

        let tableClashscore = document.getElementById("tableClashscore") as HTMLElement;
        let tableBadAngles = document.getElementById("tableBadAngles") as HTMLElement;
        let tableBadBonds = document.getElementById("tableBadBonds") as HTMLElement;
        tableClashscore.style.backgroundColor = devColor;
        tableClashscore.style.borderColor = "#d4d4d4";
        tableClashscore.style.borderWidth = "1px"
        tableBadAngles.style.backgroundColor = devColor;
        tableBadAngles.style.borderColor = "#d4d4d4";
        tableBadAngles.style.borderWidth = "1px"
        tableBadBonds.style.backgroundColor = devColor;
        tableBadBonds.style.borderColor = "#d4d4d4";
        tableBadBonds.style.borderWidth = "1px"

        if (selectedScore === QualityScore.CLASH_SCORE) {

            tableClashscore.style.borderColor = selectedBorderColor;
            tableClashscore.style.borderWidth = "3px"
        } else if (selectedScore === QualityScore.BAD_ANGLES) {
            tableBadAngles.style.borderColor = selectedBorderColor;
            tableBadAngles.style.borderWidth = "3px"
        } else {
            tableBadBonds.style.borderColor = selectedBorderColor;
            tableBadBonds.style.borderWidth = "3px"

        }
    };

    const toggleRangeMenuVisibility = () => {
        setshowRangeDetails((prevShowMenu) => !prevShowMenu);
    };

    const toggleDisplayOptionsVisibility = () => {
        setshowDisplayOptions((prevShowOptions) => !prevShowOptions);
    };

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
                    clearInterval(interval);
                    return;
                } else {
                    setMyData(data);
                    const chains = transformJobToChains(data);
                    setChainsState(chains);
                    console.log("data:", data);

                    if (data.metadata.status === "completed") {
                        clearInterval(interval); // Stop the interval loop
                        setIsLoading(false);
                    } else if (data.metadata.status === "running") {
                        setIsLoading(false);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch data:", error);
                setMyError({
                    errorMessage: "Failed to fetch data",
                    statusCode: "500",
                });
                clearInterval(interval);
            }
        }

        fetchData();
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

    function makeTable(myData: SummaryJob) {
        const indices: string[] = [];
        const original_indices: number[] = [];

        myData.results.data.forEach((residue) => {
            if (residue) {
                indices.push(residue.residue_number.toString());
            } else {
                console.warn("Unexpected residue format:", residue);
            }
        });

        indices.forEach((index) => {
            original_indices.push(myData.numeration[index]?.[0]);
        });

        {
            {
                colorGnodes()
            }
        }

        if (myData.results.mode === "fragment") {
            const clashscore = myData.results.data?.[0].metrics.clashscore;
            const pct_badangles = myData.results.data?.[0].metrics.pct_badangles;
            const pct_badbonds = myData.results.data?.[0].metrics.pct_badbonds;
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
                                Clash score
                            </th>
                            <td className="border border-neutral-300 bg-white text-2xl text-center">
                                {clashscore}
                            </td>
                        </tr>
                        <tr>
                            <th className="border border-neutral-300 bg-gray-100 p-3 text-2xl font-semibold">
                                Bad angles [%]
                            </th>
                            <td className="border border-neutral-300 bg-gray-100 text-2xl text-center">
                                {pct_badangles}
                            </td>
                        </tr>
                        <tr>
                            <th className="border border-neutral-300 bg-white p-3 text-2xl font-semibold">
                                Bad bonds [%]
                            </th>
                            <td className="border border-neutral-300 bg-white text-2xl text-center">
                                {pct_badbonds}
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            );
        } else if (myData.results.mode === "full") {
            return <table className="text-center min-w-full text-wrap">
                <thead className="sticky top-0">
                <tr className="bg-gray-100 font-semibold">
                    <th className="border border-neutral-300 text-center py-2 px-1">
                        <div className="text-sm whitespace-normal">Residue numbers</div>
                    </th>
                    <th id="tableClashscore" className="border border-neutral-300 cursor-pointer text-center py-2 px-1"
                        style={{borderColor: selectedBorderColor, borderWidth: "3px"}}
                        onClick={(event) => handleClick(QualityScore.CLASH_SCORE, event)}>
                        <div className="text-sm whitespace-normal">Clash score</div>
                    </th>
                    <th id="tableBadAngles" className="border border-neutral-300 cursor-pointer text-center py-2 px-1"
                        onClick={(event) => handleClick(QualityScore.BAD_ANGLES, event)}>
                        <div className="text-sm whitespace-normal">Bad angles [%]</div>
                    </th>
                    <th id="tableBadBonds" className="border border-neutral-300 cursor-pointer text-center py-2 px-1"
                        onClick={(event) => handleClick(QualityScore.BAD_BONDS, event)}>
                        <div className="text-sm whitespace-normal">Bad bonds [%]</div>
                    </th>
                </tr>
                </thead>
                <tbody>
                {myData.results.data.map((residue, index) => (
                    <tr key={residue.residue_number}
                        className={residue.residue_number % 2 === 0 ? "bg-gray-100" : "bg-white"}>
                        <td className="border border-neutral-300">{original_indices[index]}</td>
                        <td className="border border-neutral-300 column-CLASH_SCORE">{residue.metrics.clashscore}</td>
                        <td className="border border-neutral-300 column-BAD_ANGLES">{residue.metrics.pct_badangles}</td>
                        <td className="border border-neutral-300 column-BAD_BONDS">{residue.metrics.pct_badbonds}</td>
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
                <div>
                    <h2><b> Clash score </b></h2>
                    <div className="ml-4">
                        <div className="mb-1">
                            <span className="rounded" style={{backgroundColor: colorMapByRange.get(1)}}>&nbsp; Clash score  &lt; 10 &nbsp;
                                <br/></span>
                            <span className="rounded"
                                  style={{backgroundColor: colorMapByRange.get(2)}}>&nbsp; 10 &le; Clash score  &lt; 40 &nbsp;
                                <br/></span>
                            <span className="rounded"
                                  style={{backgroundColor: colorMapByRange.get(3)}}>&nbsp; 40 &le; Clash score  &lt; 70 &nbsp;
                                <br/></span>
                            <span className="rounded"
                                  style={{backgroundColor: colorMapByRange.get(4)}}>&nbsp; 70 &le; Clash score  &lt; 100 &nbsp;
                                <br/></span>
                            <span className="rounded" style={{backgroundColor: colorMapByRange.get(5)}}>&nbsp; Clash score &gt; 100 &nbsp;
                                <br/></span>

                        </div>
                    </div>
                    <h2><b> Bad bonds </b></h2>
                    <div className="ml-4">
                        <div className="mb-1">
                            <span className="rounded"
                                  style={{backgroundColor: colorMapByRange.get(1)}}>&nbsp; Bad bonds &lt; 0,01% &nbsp;
                                <br/> </span>
                            <span className="rounded"
                                  style={{backgroundColor: colorMapByRange.get(3)}}>&nbsp; 0,01% &le; Bad bonds &lt; 0,2% &nbsp;
                                <br/> </span>
                            <span className="rounded"
                                  style={{backgroundColor: colorMapByRange.get(5)}}>&nbsp; Bad bonds &ge; 0,2% &nbsp;
                                <br/> </span>

                        </div>
                    </div>
                    <h2><b> Bad angles </b></h2>
                    <div className="ml-4">&nbsp;
                        <div className="mb-1">
                            <span className="rounded" style={{backgroundColor: colorMapByRange.get(1)}}>&nbsp; Bad angles &lt; 0,1% &nbsp;
                                <br/> </span>
                            <span className="rounded"
                                  style={{backgroundColor: colorMapByRange.get(3)}}>&nbsp; 0,1% &le; Bad angles &lt; 0,5% &nbsp;
                                <br/> </span>
                            <span className="rounded" style={{backgroundColor: colorMapByRange.get(5)}}>&nbsp; Bad angles &ge; 0,5% &nbsp;
                                <br/> </span>
                        </div>
                    </div>
                </div>
            </div>);
    }

    const handleLabelIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLabelInterval(parseInt(e.target.value, 10));
    };

    const handleCheckboxChange = (setter: (checked: boolean) => void) => (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        setter(e.target.checked);
    };

    function createFornacDisplayDetails() {
        return (
            <div>
                <div className="flex flex-col">
                    {numbering &&
                        <label>
                            Label interval:
                            <br/>
                            <input
                                type="number"
                                value={labelInterval}
                                onChange={handleLabelIntervalChange}
                                placeholder="Label Interval"
                                className="rounded-lg w-24 mb-2 border-gray-300 border-2 pl-2 p-1"
                            />
                        </label>
                    }
                    <label className="options">
                        <input
                            type="checkbox"
                            checked={numbering}
                            onChange={handleCheckboxChange(setNumbering)}
                        />{' '}
                        Numbering
                    </label>
                    <label className="options">
                        <input
                            type="checkbox"
                            checked={nodeOutline}
                            onChange={handleCheckboxChange(setNodeOutline)}
                        />{' '}
                        Node Outline
                    </label>
                    <label className="options">
                        <input
                            type="checkbox"
                            checked={nodeLabel}
                            onChange={handleCheckboxChange(setNodeLabel)}
                        />{' '}
                        Node Label
                    </label>
                    <label className="options">
                        <input
                            type="checkbox"
                            checked={links}
                            onChange={handleCheckboxChange(setLinks)}
                        />{' '}
                        Links
                    </label>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-screen w-screen">
            <div className="flex flex-row w-full justify-between">
                <div className="flex flex-row font-medium items-center self-start ml-[30px] cursor-pointer">
                    <Logo page="Result panel"/>
                    <div className="ml-2"><HelpIcon/></div>
                </div>
                <div className="my-auto">
                    <span className="font-bold" style={{color: Colors.blue}}> Name of task: </span> {myData.name} <br/>
                    <span className="font-bold" style={{color: Colors.blue}}> ID: </span> {myData.id}
                </div>
                <div className="flex justify-center items-center h-full">
                    <button
                        id="switchViewButton"
                        onClick={toggle}
                        className="font-bold rounded-lg p-4 text-2xl text-black flex justify-center items-center my-1 mr-[30px] w-auto"
                    >
                        Switch to 3D view
                    </button>
                </div>
            </div>
            <div className="flex flex-wrap w-full h-full rounded-lg">
                <div className="flex flex-col h-full max-h-full items-center p-9 rounded-lg bg-neutral-200">
                    <div className="min-h-[12rem] max-h-[50vh] overflow-y-auto table-fixed mb-7">
                        {makeTable(myData)}
                        {colorColumn(selectedQualityScore)}
                    </div>
                    <DownloadLink/>
                    <DownloadFile id={jobId}/>
                </div>
                <div className="flex flex-grow bg-white">
                    <div className="relative w-full h-full border-2 rounded-lg border-neutral-200">
                        {myData.results.mode === "full" &&
                            <div>
                                <div
                                    className="z-40 absolute bottom-2 left-2 rounded-lg border border-neutral-300 bg-white">
                                    {!showRangeDetails && (
                                        <div>
                                            <button
                                                id="menuButton"
                                                onClick={toggleRangeMenuVisibility}
                                                className="w-full mt-0 inline-block rounded-lg bg-neutral-300 px-6 text-sm font-medium uppercase leading-normal text-neutral-900 shadow-light-3 transition duration-150 ease-in-out hover:bg-neutral-600 hover:text-white hover:shadow-light-2 focus:bg-neutral-200 focus:shadow-light-2 focus:outline-none focus:ring-0 active:bg-neutral-200 active:shadow-light-2 motion-reduce:transition-none dark:shadow-black/30 dark:hover:shadow-dark-strong dark:focus:shadow-dark-strong dark:active:shadow-dark-strong">
                                                Show coloring ranges
                                            </button>
                                        </div>)}
                                    {showRangeDetails && (
                                        <div>
                                            <button
                                                id="menuButton"
                                                onClick={toggleRangeMenuVisibility}
                                                className="w-full mt-0 inline-block rounded-lg bg-neutral-300 px-6 text-sm font-medium uppercase leading-normal text-neutral-900 shadow-light-3 transition duration-150 ease-in-out hover:bg-neutral-600 hover:text-white hover:shadow-light-2 focus:bg-neutral-200 focus:shadow-light-2 focus:outline-none focus:ring-0 active:bg-neutral-200 active:shadow-light-2 motion-reduce:transition-none dark:shadow-black/30 dark:hover:shadow-dark-strong dark:focus:shadow-dark-strong dark:active:shadow-dark-strong">
                                                Close
                                            </button>
                                            <div className="flex flex-col max-h-[50vh] overflow-y-auto p-2">
                                                {createRangeMenu()}
                                            </div>
                                        </div>)}

                                </div>
                                <div style={{display: is3Dview ? "none" : "block"}}
                                     className="z-40 absolute bottom-2 left-64 border rounded-lg border-neutral-300 bg-white">
                                    {!showDisplayOptions && (
                                        <div>
                                            <button
                                                id="menuButton"
                                                onClick={toggleDisplayOptionsVisibility}
                                                className="w-full mt-0 inline-block rounded-lg bg-neutral-300 px-6 text-sm font-medium uppercase leading-normal text-neutral-900 shadow-light-3 transition duration-150 ease-in-out hover:bg-neutral-600 hover:text-white hover:shadow-light-2 focus:bg-neutral-200 focus:shadow-light-2 focus:outline-none focus:ring-0 active:bg-neutral-200 active:shadow-light-2 motion-reduce:transition-none dark:shadow-black/30 dark:hover:shadow-dark-strong dark:focus:shadow-dark-strong dark:active:shadow-dark-strong">
                                                Fornac options
                                            </button>
                                        </div>)}
                                    {showDisplayOptions && (
                                        <div>
                                            <button
                                                id="menuButton"
                                                onClick={toggleDisplayOptionsVisibility}
                                                className="w-full mt-0 inline-block rounded-lg bg-neutral-300 px-6 text-sm font-medium uppercase leading-normal text-neutral-900 shadow-light-3 transition duration-150 ease-in-out hover:bg-neutral-600 hover:text-white hover:shadow-light-2 focus:bg-neutral-200 focus:shadow-light-2 focus:outline-none focus:ring-0 active:bg-neutral-200 active:shadow-light-2 motion-reduce:transition-none dark:shadow-black/30 dark:hover:shadow-dark-strong dark:focus:shadow-dark-strong dark:active:shadow-dark-strong">
                                                Close
                                            </button>
                                            <div className="flex flex-col max-h-[50vh] overflow-y-auto p-2">
                                                {createFornacDisplayDetails()}
                                            </div>
                                        </div>)}
                                </div>
                            </div>
                        }
                        {myData.results.mode === "fragment" &&
                            <div style={{display: is3Dview ? "none" : "block"}}
                                 className="z-40 absolute bottom-2 left-2 rounded-lg border border-neutral-300 bg-white">
                                {!showDisplayOptions && (
                                    <div>
                                        <button
                                            id="menuButton"
                                            onClick={toggleDisplayOptionsVisibility}
                                            className="w-full mt-0 inline-block rounded-lg bg-neutral-300 px-6 text-sm font-medium uppercase leading-normal text-neutral-900 shadow-light-3 transition duration-150 ease-in-out hover:bg-neutral-600 hover:text-white hover:shadow-light-2 focus:bg-neutral-200 focus:shadow-light-2 focus:outline-none focus:ring-0 active:bg-neutral-200 active:shadow-light-2 motion-reduce:transition-none dark:shadow-black/30 dark:hover:shadow-dark-strong dark:focus:shadow-dark-strong dark:active:shadow-dark-strong">
                                            Fornac options
                                        </button>
                                    </div>)}
                                {showDisplayOptions && (
                                    <div>
                                        <button
                                            id="menuButton"
                                            onClick={toggleDisplayOptionsVisibility}
                                            className="w-full mt-0 inline-block rounded-lg bg-neutral-300 px-6 text-sm font-medium uppercase leading-normal text-neutral-900 shadow-light-3 transition duration-150 ease-in-out hover:bg-neutral-600 hover:text-white hover:shadow-light-2 focus:bg-neutral-200 focus:shadow-light-2 focus:outline-none focus:ring-0 active:bg-neutral-200 active:shadow-light-2 motion-reduce:transition-none dark:shadow-black/30 dark:hover:shadow-dark-strong dark:focus:shadow-dark-strong dark:active:shadow-dark-strong">
                                            Close
                                        </button>
                                        <div className="flex flex-col max-h-[50vh] overflow-y-auto p-2">
                                            {createFornacDisplayDetails()}
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
                                colorGnodes={colorGnodes}
                            />
                            {/*{colorGnodes()}*/}
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
                </div>
            </div>
        </div>
    );
};

export default SummaryPanel;
