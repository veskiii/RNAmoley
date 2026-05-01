import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import Loading from "../common/loading";
import Molstar from "../visualizations/molStarSummaryComponent";
import FornacSummaryComponent from "../visualizations/fornaSummaryComponent";
import {
  badAnglesColorMap,
  badBondsColorMap,
  Chain,
  clashScoreColorMap,
  QualityScore,
  SummaryJob,
} from "../utils/types";
import { Colors } from "../common/colors";
import DownloadLink from "../common/downloadLink";
import DownloadFile from "../common/downloadFile";
import ErrorPage, { ErrorPageProps } from "../common/ErrorPage";
import { colorMapByRange, getColor } from "../utils/ColorUtils";
import { transformJobToChains } from "../utils/transformJobToChains";
import { fetchMyData, startSimulation } from "../utils/api";
import SmallScreenPage from "../common/smallScreenPage";
import TopPanel from "../common/topPanel";
import Footer from "../common/footerComponent";
import ResultsResidueTable from "../visualizations/ResultsResidueTable";
import GlobalResultsTable from "../visualizations/GlobalResultsTable";
import SimulationStartModal, { SimulationFormValues } from "./SimulationStartModal";

const SummaryPanel: React.FC = () => {
  type ResultsSource = "original" | "simulation";

  const { jobId, modelNumber } = useParams();
  const [selectedModel, setSelectedModel] = useState<number>(
    modelNumber ? parseInt(modelNumber) : 1
  );
  const [myData, setMyData] = useState<SummaryJob>();
  const [myError, setMyError] = useState<ErrorPageProps | null>(null);
  const [labelInterval, setLabelInterval] = useState(10);
  const [numbering, setNumbering] = useState(true);
  const [nodeOutline, setNodeOutline] = useState(true);
  const [nodeLabel, setNodeLabel] = useState(true);
  const [links, setLinks] = useState(true);
  const [showClashes, setShowClashes] = useState(true);
  const [animation, setAnimation] = useState(false);
  const [showRangeDetails, setshowRangeDetails] = useState(false);
  const [showDisplayOptions, setshowDisplayOptions] = useState(false);
  const [showFornaSettings, setShowFornaSettings] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedQualityScore, setQualityScore] = useState<QualityScore>(
    QualityScore.CLASH_SCORE
  );
  const [chainsState, setChainsState] = useState<Chain[]>([]);
  const [sidebarTab, setSidebarTab] = useState(0);
  const [isSimulationModalOpen, setIsSimulationModalOpen] = useState(false);
  const [isStartingSimulation, setIsStartingSimulation] = useState(false);
  const [simulationStartError, setSimulationStartError] = useState<string | null>(null);
  const [simulationStartSuccess, setSimulationStartSuccess] = useState<string | null>(null);
  const [selectedResultsSource, setSelectedResultsSource] = useState<ResultsSource>("original");
  const [refreshToken, setRefreshToken] = useState(0);
  const hasStoppedLoading = useRef(false);

  const isSimulationStatus = (status: string) => status.startsWith("simulation_");
  const selectedModelStatus = myData?.metadata.resultsStatus?.[selectedModel.toString()]?.status;
  const canStartSimulation =
    ["completed", "sim_completed", "sim_failed"].includes(selectedModelStatus || "") ||
    (!selectedModelStatus && myData?.metadata.status === "completed");
  const simulationTabEnabled = selectedModelStatus === "sim_completed";
  const isSimulationInProgress = ["sim_starting", "sim_running", "sim_finished", "sim_analyzing"].includes(selectedModelStatus || "");
  const hasSimulationStarted = (selectedModelStatus || "").startsWith("sim_");

  useEffect(() => {
    if (selectedResultsSource === "simulation" && !simulationTabEnabled) {
      setSelectedResultsSource("original");
    }
  }, [selectedResultsSource, simulationTabEnabled]);

  const getModelStatusPresentation = (status?: string) => {
    if (!status) {
      return { label: "", className: "" };
    }

    if (status === "created") {
      return { label: "Created", className: "bg-slate-200 text-slate-900" };
    }

    if (status === "starting") {
      return { label: "Starting", className: "bg-yellow-300 text-black" };
    }

    if (status === "running") {
      return {
        label: "Running",
        className: "bg-blue-500 text-white",
      };
    }

    if (status === "completed") {
      return { label: "Completed", className: "bg-green-600 text-white" };
    }

    if (status === "failed") {
      return { label: "Failed", className: "bg-red-500 text-white" };
    }

    if (status === "sim_starting") {
      return { label: "Simulation starting", className: "bg-cyan-300 text-cyan-950" };
    }

    if (status === "sim_running") {
      return { label: "Simulation running", className: "bg-cyan-500 text-white" };
    }

    if (status === "sim_finished") {
      return { label: "Simulation done", className: "bg-sky-600 text-white" };
    }

    if (status === "sim_analyzing") {
      return { label: "Analyzing simulation", className: "bg-indigo-600 text-white" };
    }

    if (status === "sim_completed") {
      return { label: "Simulation completed", className: "bg-cyan-700 text-white" };
    }

    if (status === "sim_failed") {
      return { label: "Simulation failed", className: "bg-rose-600 text-white" };
    }

    return { label: status, className: "bg-gray-300 text-black" };
  };

  const getModelListStatus = (status?: string) => {
    if (!status) return status;
    if (status.startsWith("sim_")) return "completed";
    return status;
  };

  const simulationStatusPresentation = getModelStatusPresentation(selectedModelStatus);

  const getClashesForForna = () => {
    if (showClashes && myData) {
      const clashes = new Set();
      for (const item of myData.results.data) {
        const sourceNum = item.residue_number;

        if (!item.residueMetrics) continue;

        const dstString = item.residueMetrics.dst_residue;

        if (!dstString) continue;

        const parts = dstString.trim().split(/\s+/);
        if (parts.length < 2) continue;

        const dstNum = parseInt(parts[1]);

        if (sourceNum === dstNum) continue;

        const clashPair = [sourceNum, dstNum].sort((a, b) => a - b);
        clashes.add(JSON.stringify(clashPair));
      }

      //@ts-ignore
      const result = Array.from(clashes).map((str) => JSON.parse(str));

      return result;
    }
  };

  const colorGnodes = () => {
    if (!myData || !myData.results || !myData.results.data) {
      console.warn("No data in myData.results.data");
      return;
    }
    //@ts-ignore
    const nodes = d3.selectAll("circle.fornac-node");
    nodes.style("fill", "white");

    const nodeByNumber = new Map<number, any>();
    nodes.each(function () {
      //@ts-ignore
      const node = d3.select(this);
      const nodeNum = parseInt(node.attr("node_num"), 10);
      if (!Number.isNaN(nodeNum)) {
        nodeByNumber.set(nodeNum, node);
      }
    });

    myData.results.data.forEach((residue) => {
      try {
        const node = nodeByNumber.get(residue.residue_number);
        if (node) {
          node
            .classed("fornac-selectedNode", true)
            .style("fill", getColor(residue, selectedQualityScore));
        } else {
          // console.warn(`Node with index ${residue.residue_number} not found`);
        }
      } catch (error) {
        console.error("Failed to select node:", error);
      }
    });
  };

  useEffect(() => {
    colorGnodes();
  }, [
    labelInterval,
    numbering,
    nodeOutline,
    nodeLabel,
    links,
    showClashes,
    setAnimation,
    selectedQualityScore,
    myData,
  ]);

  const updateColorMaps = () => {
    if (!myData || !myData.results || !myData.results.data) {
      console.error("No data in myData.results.data");
      return;
    }

    myData.results.data.forEach((residue) => {
      var color = getColor(residue, QualityScore.CLASH_SCORE);
      clashScoreColorMap.set(residue.residue_number, color);
      color = getColor(residue, QualityScore.BAD_ANGLES);
      badAnglesColorMap.set(residue.residue_number, color);
      color = getColor(residue, QualityScore.BAD_BONDS);
      badBondsColorMap.set(residue.residue_number, color);
    });
  };

  useEffect(() => {
    updateColorMaps();
  }, [myData]);


  const toggleRangeMenuVisibility = () => {
    setshowRangeDetails((prevShowMenu) => !prevShowMenu);
  };

  const toggleDisplayOptionsVisibility = () => {
    setshowDisplayOptions((prevShowOptions) => !prevShowOptions);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout; // Declare interval variable
    async function fetchData() {
      //console.log("Start to fetch data");
      try {
        const effectiveResultsSource =
          selectedResultsSource === "simulation" && simulationTabEnabled
            ? "simulation"
            : "original";
        const response = await fetchMyData(jobId, selectedModel, effectiveResultsSource);
        const data = await response.json();
        if (!response.ok) {
          // console.log(
          //     `Error during fetching data. Message: ${data.error} Status code: ${response.status}`
          // );
          setMyError({
            errorMessage: data.error,
            statusCode: response.status.toString(),
          });
          clearInterval(interval);
          return;
        } else {
            setMyData((prevData) => {
            if (JSON.stringify(prevData) !== JSON.stringify(data)) {
              const chains = transformJobToChains(data);
              setChainsState((prevChains) => 
              JSON.stringify(prevChains) !== JSON.stringify(chains) ? chains : prevChains
              );
              return data;
            }
            return prevData;
            });
          console.log("data:", data);

            if (data.metadata.status === "failed") {
            setMyError({
              errorMessage: data.metadata.error_message,
              statusCode: "500",
            });
            clearInterval(interval);
            return;
            }
            if (
              data.results &&
              (data.metadata.status === "running" || data.metadata.status === "completed" || isSimulationStatus(data.metadata.status)) &&
              data.results &&
              isLoading &&
              !hasStoppedLoading.current
            ) {
              console.log("stop loading ", isLoading);
              setInitialQualityScore(data);
              setIsLoading(false);
              hasStoppedLoading.current = true;
            }

            const currentModelStatus = data.metadata.resultsStatus?.[selectedModel.toString()]?.status;
            const isBackgroundWorkActive =
              ["creating", "starting", "running", "simulation_starting", "simulation_running"].includes(data.metadata.status) ||
              ["starting", "running", "sim_starting", "sim_running", "sim_finished", "sim_analyzing"].includes(currentModelStatus || "");

            if (!isBackgroundWorkActive) {
              if (isLoading && data.results) setInitialQualityScore(data);
              clearInterval(interval);
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
  }, [jobId, selectedModel, selectedResultsSource, refreshToken]);

  const setInitialQualityScore = (data: SummaryJob) => {
    if (data && data.metadata.analyzeNeighborhoods) {
      setQualityScore(QualityScore.CLASH_SCORE);
    } else {
      setQualityScore(QualityScore.SUITENESS);
    }
  };

  const handleStartSimulation = async (values: SimulationFormValues) => {
    if (!jobId) {
      setSimulationStartError("Brak ID zadania.");
      return;
    }

    setIsStartingSimulation(true);
    setSimulationStartError(null);
    setSimulationStartSuccess(null);

    try {
      await startSimulation({
        id: jobId,
        modelNumber: selectedModel,
        restraintBackboneForce: values.restraintBackboneForce,
        restraintGlobalForce: values.restraintGlobalForce,
        restraintBasePairsForce: values.restraintBasePairsForce,
        rmsdCutoff: values.rmsdCutoff,
      });

      setSimulationStartSuccess("Simulation started.");
      setIsSimulationModalOpen(false);
      setSelectedResultsSource("original");
      setRefreshToken((prev) => prev + 1);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start simulation.";
      setSimulationStartError(message);
    } finally {
      setIsStartingSimulation(false);
    }
  };

  

  if (myError) {
    var message = myError.errorMessage;
    var code = myError.statusCode;
    return <ErrorPage errorMessage={message} statusCode={code} />;
  }

  if (isLoading) {
    return <Loading />;
  }

  if (!myData || !myData.results || !myData.results.data ) {
    return <ErrorPage />;
  }


  function createRangeMenu() {
    return (
      <div>
        <div>
          <h2>
            <b>Clashscore</b>
          </h2>
          <div className="ml-4">
            <div className="mb-1">
              <span
                className="rounded"
                style={{ backgroundColor: colorMapByRange.get(1) }}
              >
                &nbsp;Clashscore &lt; 10 &nbsp;
                <br />
              </span>
              <span
                className="rounded"
                style={{ backgroundColor: colorMapByRange.get(2) }}
              >
                &nbsp; 10 &le;Clashscore &lt; 40 &nbsp;
                <br />
              </span>
              <span
                className="rounded"
                style={{ backgroundColor: colorMapByRange.get(3) }}
              >
                &nbsp; 40 &le;Clashscore &lt; 70 &nbsp;
                <br />
              </span>
              <span
                className="rounded"
                style={{ backgroundColor: colorMapByRange.get(4) }}
              >
                &nbsp; 70 &le;Clashscore &lt; 100 &nbsp;
                <br />
              </span>
              <span
                className="rounded"
                style={{ backgroundColor: colorMapByRange.get(5) }}
              >
                &nbsp;Clashscore &gt; 100 &nbsp;
                <br />
              </span>
            </div>
          </div>
          <h2>
            <b> Bad bonds </b>
          </h2>
          <div className="ml-4">
            <div className="mb-1">
              <span
                className="rounded"
                style={{ backgroundColor: colorMapByRange.get(1) }}
              >
                &nbsp; Bad bonds &lt; 0,01% &nbsp;
                <br />{" "}
              </span>
              <span
                className="rounded"
                style={{ backgroundColor: colorMapByRange.get(3) }}
              >
                &nbsp; 0,01% &le; Bad bonds &lt; 0,2% &nbsp;
                <br />{" "}
              </span>
              <span
                className="rounded"
                style={{ backgroundColor: colorMapByRange.get(5) }}
              >
                &nbsp; Bad bonds &ge; 0,2% &nbsp;
                <br />{" "}
              </span>
            </div>
          </div>
          <h2>
            <b> Bad angles </b>
          </h2>
          <div className="ml-4">
            &nbsp;
            <div className="mb-1">
              <span
                className="rounded"
                style={{ backgroundColor: colorMapByRange.get(1) }}
              >
                &nbsp; Bad angles &lt; 0,1% &nbsp;
                <br />{" "}
              </span>
              <span
                className="rounded"
                style={{ backgroundColor: colorMapByRange.get(3) }}
              >
                &nbsp; 0,1% &le; Bad angles &lt; 0,5% &nbsp;
                <br />{" "}
              </span>
              <span
                className="rounded"
                style={{ backgroundColor: colorMapByRange.get(5) }}
              >
                &nbsp; Bad angles &ge; 0,5% &nbsp;
                <br />{" "}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleLabelIntervalChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setLabelInterval(parseInt(e.target.value, 10));
  };

  const handleCheckboxChange =
    (setter: (checked: boolean) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.checked);
    };

    const changeModel = (modelNum: number) => {
      if (
        myData &&
        myData.metadata.resultsStatus &&
        myData.metadata.resultsStatus[modelNum.toString()] &&
        myData.metadata.resultsStatus[modelNum.toString()].status === "starting"
      ) {
        return;
      }

      const targetModelStatus = myData?.metadata.resultsStatus?.[modelNum.toString()]?.status;
      if (selectedResultsSource === "simulation" && targetModelStatus !== "sim_completed") {
        setSelectedResultsSource("original");
      }

      setSelectedModel(modelNum);
    }

  function createFornacDisplayDetails() {
    return (
      <div>
        <div className="flex flex-col">
          {numbering && (
            <label>
              Label interval:
              <br />
              <input
                type="number"
                value={labelInterval}
                onChange={handleLabelIntervalChange}
                placeholder="Label Interval"
                className="rounded-lg w-24 mb-2 border-gray-300 border-2 pl-2 p-1"
              />
            </label>
          )}
          <label className="options">
            <input
              type="checkbox"
              checked={numbering}
              onChange={handleCheckboxChange(setNumbering)}
            />{" "}
            Numbering
          </label>
          <label className="options">
            <input
              type="checkbox"
              checked={nodeOutline}
              onChange={handleCheckboxChange(setNodeOutline)}
            />{" "}
            Node Outline
          </label>
          <label className="options">
            <input
              type="checkbox"
              checked={nodeLabel}
              onChange={handleCheckboxChange(setNodeLabel)}
            />{" "}
            Node Label
          </label>
          <label className="options">
            <input
              type="checkbox"
              checked={links}
              onChange={handleCheckboxChange(setLinks)}
            />{" "}
            Links
          </label>
          <label className="options">
            <input
              type="checkbox"
              checked={showClashes}
              onChange={handleCheckboxChange(setShowClashes)}
            />{" "}
            Clashes
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="desktop-content h-screen w-screen overflow-hidden">
      {/* Top panel */}
        <TopPanel page="Results Panel"/>
      {/* Side view + Main content */}
      <div className="flex overflow-hidden h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <div className="w-80">
          <div
            className="flex flex-col  bg-moley-backgroundGreen h-full w-80 px-4 pt-10 p-2 rounded-t-lg justify-between"
          >
            {/* Scrollowalna zawartość sidebar'a */}
            <div className="rounded-scrollbar overflow-auto flex-1">
              <div className="mb-4 rounded-lg bg-white p-3 shadow">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  Job name
                </div>
                <div className="truncate text-sm font-semibold text-gray-900" title={myData.name || "Unnamed job"}>
                  {myData.name || "Unnamed job"}
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wide mt-2 text-gray-500">
                    Sphere radius (Å):
                  </span>
                  <span className="truncate text-sm font-semibold ml-2 text-gray-900">
                    {myData.metadata.radius === undefined || myData.metadata.radius === null || myData.metadata.radius === -1
                      ? "N/A"
                      : myData.metadata.radius}
                  </span>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wide mt-2 text-gray-500">
                    Sphere interval:
                  </span>
                  <span className="truncate text-sm font-semibold ml-2 text-gray-900">
                    {myData.metadata.interval === undefined || myData.metadata.interval === null || myData.metadata.interval === -1
                      ? "N/A"
                      : myData.metadata.interval}
                  </span>
                </div>
              </div>
              {/* Tabs */}
              <div className="flex mb-4">
                <div
                  className={`flex-1 py-2 rounded-t-lg text-center cursor-pointer ${sidebarTab === 0 ? "bg-white font-bold shadow" : "bg-moley-backgroundLightGreen"}`}
                  onClick={() => setSidebarTab(0)}
                >
                  Models
                </div>
              </div>
              {/* Inside tabs */}
              
              {sidebarTab === 0 && (
                <>
                  {Array.from({ length: myData.metadata.model_count }, (_, i) => {
                    const modelNum = i + 1;
                    const modelStatus = myData.metadata.resultsStatus?.[modelNum.toString()]?.status;
                    const modelListStatus = getModelListStatus(modelStatus);
                    const modelStatusPresentation = getModelStatusPresentation(modelListStatus);
                    const isModelAccessable = modelStatus && ["running", "completed", "sim_starting", "sim_running", "sim_finished", "sim_analyzing", "sim_completed", "sim_failed"].includes(modelStatus);
                    return (
                      <div
                        key={"model" + modelNum}
                        className={`mb-4 p-2 bg-white rounded shadow transition-all
                          ${myData && isModelAccessable ?
                              "cursor-pointer" : "cursor-not-allowed"}
                          ${selectedModel === modelNum ? "border-2 border-moley-darkGreen" : "border border-transparent"
                        } flex items-center justify-between`}
                        onClick={() => isModelAccessable && changeModel(modelNum)}
                      >
                        <span>Model {modelNum}</span>
                        {myData && myData.metadata.resultsStatus && (
                          <div className="flex flex-col items-end">
                            <span
                              className={`ml-2 p-2 rounded-full inline-block ${modelStatusPresentation.className}`}
                              title={modelListStatus || ""}
                            >{modelStatusPresentation.label}
                            </span>
                            {["failed"].includes(modelStatus || "") && (
                              <div className="text-red-500 text-sm mt-1">${myData.metadata.resultsStatus[modelNum].error_message}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

            </div>
            <div className="mt-3 rounded-lg bg-white p-3 shadow">
              <div
                role="button"
                tabIndex={canStartSimulation ? 0 : -1}
                aria-disabled={!canStartSimulation}
                onClick={() => {
                  if (!canStartSimulation) return;
                  setSimulationStartError(null);
                  setSimulationStartSuccess(null);
                  setIsSimulationModalOpen(true);
                }}
                onKeyDown={(e) => {
                  if (!canStartSimulation) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSimulationStartError(null);
                    setSimulationStartSuccess(null);
                    setIsSimulationModalOpen(true);
                  }
                }}
                className={`w-full rounded-lg bg-moley-darkGreen px-4 py-2 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-moley-darkGreen ${
                  canStartSimulation ? "hover:opacity-95 cursor-pointer" : "cursor-not-allowed opacity-50"
                }`}
                title={canStartSimulation ? "" : "Structure correction is available after the analysis is completed."}
              >
                {canStartSimulation ? "Correct the structure" : "Correct the structure (available after completed)"}
              </div>
              {simulationStartSuccess && (
                <p className="mt-2 text-sm text-green-700">{simulationStartSuccess}</p>
              )}
              {simulationStartError && (
                <p className="mt-2 text-sm text-red-700">{simulationStartError}</p>
              )}

              {hasSimulationStarted && (
                <div className="mt-3 border-t border-gray-200 pt-3">
                  <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">Results source</div>
                  <div className="flex flex-col gap-2">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedResultsSource("original")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedResultsSource("original");
                        }
                      }}
                      className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-moley-darkGreen ${
                        selectedResultsSource === "original"
                          ? "bg-moley-darkGreen text-white"
                          : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                      }`}
                    >
                      Original results
                    </div>

                    <div
                      role="button"
                      tabIndex={simulationTabEnabled ? 0 : -1}
                      aria-disabled={!simulationTabEnabled}
                      onClick={() => {
                        if (simulationTabEnabled) {
                          setSelectedResultsSource("simulation");
                        }
                      }}
                      onKeyDown={(e) => {
                        if (!simulationTabEnabled) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedResultsSource("simulation");
                        }
                      }}
                      className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-moley-darkGreen ${
                        selectedResultsSource === "simulation"
                          ? "bg-moley-darkGreen text-white"
                          : "bg-gray-100 text-gray-800"
                      } ${!simulationTabEnabled ? "cursor-not-allowed opacity-60" : "hover:bg-gray-200"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>Simulation results</span>
                        {isSimulationInProgress && (
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                        )}
                      </div>
                      <div className="mt-1">
                        <span className={`inline-block rounded-full px-2 py-1 text-xs ${simulationStatusPresentation.className || "bg-gray-300 text-black"}`}>
                          {simulationStatusPresentation.label || "No simulation"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Przyciski pobierania*/}
            <div className="mt-4 flex justify-center">
            <DownloadLink />
            <DownloadFile id={jobId} />
            </div>
          </div>
        </div>
        {/* Main content */}
        <div 
          key={myData.id}
          className="flex-1 overflow-y-auto overflow-x-hidden"
        >
          <div className="flex flex-col min-h-full">
            <div className="w-2/3 3xl:w-1/2">
              <GlobalResultsTable 
              modelMetrics={myData.results.modelMetrics} 
              fragmentMetrics={myData.results.fragmentMetrics} />
            </div>
            <div className="bg-transparent z-10">
              <div className="overflow-x-auto">
                {/* residue table */}
                <ResultsResidueTable
                key={`residue-table-${selectedModel}-${selectedResultsSource}`}
                data={myData.results.data}
                analyzeNeighborhood={myData.metadata.analyzeNeighborhoods}
                selectedScore={selectedQualityScore}
                setSelectedScore={setQualityScore}
                modelStatus={selectedModelStatus}
                />
              </div>
            </div>
            <div className="flex flex-row h-[60vh] min-h-[400px]">
              <div className="w-1/2 h-full p-5 relative">
                {/* Gear icon button */}
                <button
                  onClick={() => setShowFornaSettings(!showFornaSettings)}
                  className="absolute top-5 right-5 z-20 px-2 py-1 bg-white rounded-lg shadow hover:bg-gray-100 transition text-lg w-fit"
                  title="Toggle Forna settings"
                >
                  ⚙️
                </button>

                {/* Floating settings panel */}
                {showFornaSettings && (
                  <div className="absolute inset-0 z-30 p-5 bg-white rounded-lg shadow-lg overflow-auto">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold">Forna settings</h3>
                      <button
                        onClick={() => setShowFornaSettings(false)}
                        className="px-2 py-1 bg-white rounded-lg shadow hover:bg-gray-100 text-gray-500 hover:text-gray-700 text-lg w-fit"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex flex-col gap-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={numbering}
                          onChange={e => setNumbering(e.target.checked)}
                          className="mr-2"
                        />
                        <span>Numbering</span>
                      </label>
                      {numbering && (
                        <div className="ml-4 mb-2">
                          <label className="block text-sm font-medium mb-1">Label interval</label>
                          <input
                            type="number"
                            min={1}
                            value={labelInterval}
                            onChange={e => setLabelInterval(Number(e.target.value))}
                            className="w-full border rounded px-2 py-1"
                          />
                        </div>
                      )}
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={nodeOutline}
                          onChange={e => setNodeOutline(e.target.checked)}
                          className="mr-2"
                        />
                        <span>Node outline</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={nodeLabel}
                          onChange={e => setNodeLabel(e.target.checked)}
                          className="mr-2"
                        />
                        <span>Node label</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={links}
                          onChange={e => setLinks(e.target.checked)}
                          className="mr-2"
                        />
                        <span>Show connectivity</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={showClashes}
                          onChange={e => setShowClashes(e.target.checked)}
                          className="mr-2"
                        />
                        <span>Show Clashes</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={animation}
                          onChange={e => setAnimation(e.target.checked)}
                          className="mr-2"
                        />
                        <span>Animation</span>
                      </label>
                    </div>
                  </div>
                )}

                <FornacSummaryComponent
                  key={`forna-${selectedModel}-${selectedResultsSource}`}
                  structures={myData.annotation.map((a) => a.dotbracket)}
                  sequences={myData.annotation.map((a) => a.sequnece)}
                  clashMap={getClashesForForna() || []}
                  chains={chainsState}
                  setChains={setChainsState}
                  labelInterval={labelInterval}
                  numbering={numbering}
                  nodeOutline={nodeOutline}
                  nodeLabel={nodeLabel}
                  links={links}
                  showClashes={showClashes}
                  directionArrows={false}
                  setAnimation={animation}
                  job={myData}
                  colorGnodes={colorGnodes}
                />
              </div>
              <div className="w-1/2 h-full p-5">
                <Molstar
                  key={`molstar-${selectedModel}-${selectedResultsSource}`}
                  useInterface={true}
                  file={myData.pdb_file_string}
                  chains={chainsState}
                  setChains={setChainsState}
                  initialized={initialized}
                  setInitialized={setInitialized}
                  resultResidues={myData.results.data}
                  selectedQualityScore={selectedQualityScore}
                  radius={myData.metadata.radius}
                />
              </div>
            </div>
            <div className="mt-auto">
              <Footer />
            </div>
          </div>
        </div>
      </div>
      <SmallScreenPage />
      <SimulationStartModal
        isOpen={isSimulationModalOpen}
        isSubmitting={isStartingSimulation}
        errorMessage={simulationStartError || undefined}
        onClose={() => {
          if (!isStartingSimulation) {
            setIsSimulationModalOpen(false);
          }
        }}
        onSubmit={handleStartSimulation}
      />
    </div>
  );
};

export default SummaryPanel;
