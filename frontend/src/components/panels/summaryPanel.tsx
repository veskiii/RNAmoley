import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import Loading from "../common/loading";
import Molstar from "../visualizations/molStarSummaryComponent";
import html2canvas from "html2canvas";
import FornacSummaryComponent from "../visualizations/fornaSummaryComponent";
import {
  badAnglesColorMap,
  badBondsColorMap,
  Chain,
  clashScoreColorMap,
  QualityScore,
  SummaryJob,
} from "../utils/types";
import DownloadLink from "../common/downloadLink";
import DownloadFile from "../common/downloadFile";
import ErrorPage, { ErrorPageProps } from "../common/ErrorPage";
import { getColor } from "../utils/ColorUtils";
import { transformJobToChains } from "../utils/transformJobToChains";
import { fetchMyData, startSimulation } from "../utils/api";
import TopPanel from "../common/topPanel";
import Footer from "../common/footerComponent";
import ResultsResidueTable from "../visualizations/ResultsResidueTable";
import GlobalResultsTable from "../visualizations/GlobalResultsTable";
import ChainMetricLineChart from "../visualizations/ChainMetricLineChart";
import SimulationStartModal, { SimulationFormValues } from "./SimulationStartModal";

const SummaryPanel: React.FC = () => {
  type ResultsSource = "original" | "simulation";

  const { jobId, modelNumber } = useParams();
  const [selectedModel, setSelectedModel] = useState<number>(
    modelNumber ? parseInt(modelNumber) : 1
  );
  const [selectedChain, setSelectedChain] = useState<string>("");
  const [selectedResultsSource, setSelectedResultsSource] = useState<ResultsSource>("original");
  const [originalResults, setOriginalResults] = useState<SummaryJob>();
  const [simulationResults, setSimulationResults] = useState<SummaryJob>();

  const selectedModelStatus = originalResults?.metadata.resultsStatus?.[selectedModel.toString()]?.status;
  const simulationTabEnabled = selectedModelStatus === "sim_completed";
  // Which results are currently displayed: simulation (if selected and available) or original
  const displayedResults =
    selectedResultsSource === "simulation" && simulationTabEnabled && simulationResults
      ? simulationResults
      : originalResults;
  const [myError, setMyError] = useState<ErrorPageProps | null>(null);
  const [labelInterval, setLabelInterval] = useState(10);
  const [numbering, setNumbering] = useState(true);
  const [nodeOutline, setNodeOutline] = useState(true);
  const [nodeLabel, setNodeLabel] = useState(true);
  const [links, setLinks] = useState(true);
  const [showClashes, setShowClashes] = useState(true);
  const [animation, setAnimation] = useState(false);
  const [showFornaSettings, setShowFornaSettings] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedQualityScore, setQualityScore] = useState<QualityScore>(
    QualityScore.CLASH_SCORE
  );
  const [selectedQualityScoreInResidueTable, setQualityScoreInResidueTable] = useState<QualityScore>(
    QualityScore.CLASH_SCORE
  );
  const [chainsState, setChainsState] = useState<Chain[]>([]);
  const [isSimulationModalOpen, setIsSimulationModalOpen] = useState(false);
  const [isStartingSimulation, setIsStartingSimulation] = useState(false);
  const [simulationStartError, setSimulationStartError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const hasStoppedLoading = useRef(false);
  const fornaContainerRef = useRef<HTMLDivElement>(null);
  const [showResidueTable, setShowResidueTable] = useState(false);
  const [comparisonModeMolstar, setComparisonModeMolstar] = useState(false);

  const isSimulationStatus = (status: string) => status.startsWith("simulation_");
  const canStartSimulation =
    ["completed", "sim_completed", "sim_failed"].includes(selectedModelStatus || "") ||
    (!selectedModelStatus && originalResults?.metadata.status === "completed");
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
      return { label: "Refinement starting", className: "bg-cyan-300 text-cyan-950" };
    }

    if (status === "sim_running") {
      return { label: "Refinement running", className: "bg-cyan-500 text-white" };
    }

    if (status === "sim_finished") {
      return { label: "Refinement done", className: "bg-sky-600 text-white" };
    }

    if (status === "sim_analyzing") {
      return { label: "Analyzing results", className: "bg-indigo-600 text-white" };
    }

    if (status === "sim_completed") {
      return { label: "Refinement completed", className: "bg-cyan-700 text-white" };
    }

    if (status === "sim_failed") {
      return { label: "Refinement failed", className: "bg-rose-600 text-white" };
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
    if (showClashes && displayedResults) {
      const clashes = new Set();
      for (const item of displayedResults.results.data) {
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
    if (!displayedResults || !displayedResults.results || !displayedResults.results.data) {
      console.warn("No data in displayedResults.results.data");
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

    displayedResults.results.data.forEach((residue) => {
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
    displayedResults,
  ]);

  const updateColorMaps = () => {
    if (!displayedResults || !displayedResults.results || !displayedResults.results.data) {
      console.error("No data in displayedResults.results.data");
      return;
    }

    displayedResults.results.data.forEach((residue) => {
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
  }, [displayedResults]);


  useEffect(() => {
    let interval: NodeJS.Timeout; // Declare interval variable
    async function fetchData() {
      try {
        // Always fetch original results so originalResults holds only the original data
        const origResponse = await fetchMyData(jobId, selectedModel, "original");
        const origData = await origResponse.json();

        if (!origResponse.ok) {
          setMyError({
            errorMessage: origData.error,
            statusCode: origResponse.status.toString(),
          });
          clearInterval(interval);
          return;
        } else {
          setOriginalResults((prevData) => {
            if (JSON.stringify(prevData) !== JSON.stringify(origData)) {
              const chains = transformJobToChains(origData);
              setChainsState((prevChains) =>
                JSON.stringify(prevChains) !== JSON.stringify(chains) ? chains : prevChains
              );
              setSelectedChain(chains[0]?.name || "");
              return origData;
            }
            return prevData;
          });

          if (origData.metadata.status === "failed") {
            setMyError({
              errorMessage: origData.metadata.error_message,
              statusCode: "500",
            });
            clearInterval(interval);
            return;
          }

          if (
            origData.results &&
            (origData.metadata.status === "running" || origData.metadata.status === "completed" || isSimulationStatus(origData.metadata.status)) &&
            isLoading &&
            !hasStoppedLoading.current
          ) {
            setInitialQualityScore(origData);
            setIsLoading(false);
            hasStoppedLoading.current = true;
          }

          const currentModelStatus = origData.metadata.resultsStatus?.[selectedModel.toString()]?.status;
          const isBackgroundWorkActive =
            ["creating", "starting", "running", "simulation_starting", "simulation_running"].includes(origData.metadata.status) ||
            ["starting", "running", "sim_starting", "sim_running", "sim_finished", "sim_analyzing"].includes(currentModelStatus || "");

          if (!isBackgroundWorkActive) {
            if (isLoading && origData.results) setInitialQualityScore(origData);
            clearInterval(interval);
            setIsLoading(false);
          }
        }

        // If simulation tab is enabled, fetch simulation results separately and store them in simulationResults
        if (simulationTabEnabled) {
          try {
            const simResponse = await fetchMyData(jobId, selectedModel, "simulation");
            const simData = await simResponse.json();
            if (simResponse.ok) {
              setSimulationResults((prev) => {
                return JSON.stringify(prev) !== JSON.stringify(simData) ? simData : prev;
              });
            } else {
              // If simulation fetch failed, clear simulationResults to avoid showing stale sim data
              setSimulationResults(undefined);
            }
          } catch (err) {
            console.error("Failed to fetch simulation data:", err);
            setSimulationResults(undefined);
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
  }, [jobId, selectedModel, selectedResultsSource, refreshToken, simulationTabEnabled]);

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

    try {
      await startSimulation({
        id: jobId,
        modelNumber: selectedModel,
        restraintBackboneForce: values.restraintBackboneForce,
        restraintGlobalForce: values.restraintGlobalForce,
        restraintBasePairsForce: values.restraintBasePairsForce,
        rmsdCutoff: values.rmsdCutoff,
      });

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
    return <Loading  message="Preparing data and computing initial analysis..."/>;
  }

  if (!originalResults || !originalResults.results || !originalResults.results.data ) {
    return <ErrorPage />;
  }


  const handleDownloadFornaView = async () => {
    if (!fornaContainerRef.current) {
      console.error("Forna container not found");
      return;
    }

    try {
      const canvas = await html2canvas(fornaContainerRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `forna-structure-${selectedModel}-${new Date().toISOString().split('T')[0]}.png`;
      link.click();
    } catch (error) {
      console.error("Failed to download Forna view:", error);
    }
  };

    const changeModel = (modelNum: number) => {
      if (
        originalResults &&
        originalResults.metadata.resultsStatus &&
        originalResults.metadata.resultsStatus[modelNum.toString()] &&
        originalResults.metadata.resultsStatus[modelNum.toString()].status === "starting"
      ) {
        return;
      }

      const targetModelStatus = originalResults?.metadata.resultsStatus?.[modelNum.toString()]?.status;
      if (selectedResultsSource === "simulation" && targetModelStatus !== "sim_completed") {
        setSelectedResultsSource("original");
      }

      setSelectedModel(modelNum);
    }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col">
      {/* Desktop view */}
      <div className="flex flex-col h-full w-full">
        {/* Top panel */}
        <TopPanel />
        {/* Main content */}
        <div className="text-gray-800 text-sm/6 overflow-y-auto min-h-0">
        {/* Scrollable content */}
          <div className="mx-2 md:mx-16">
            {/* Job data */}
            <div className="mt-10 text-gray-500">
              <p>Input data</p>
              <div className="mt-2 space-y-0">
                <p><span>Structure:</span><i className="ml-2">{originalResults.name || "Unnamed job"}</i></p>
                <p><span>Analysed models (chains): </span>
                {originalResults.metadata.resultsStatus && Object.keys(originalResults.metadata.resultsStatus).length > 0 ? (
                    (() => {
                      const entries = Object.entries(originalResults.metadata.resultsStatus);
                      return entries.map(([modelNum, modelStatus], idx) => (
                        <span key={modelNum}>
                          {modelNum} ({modelStatus.chains?.join(", ") || ""}){idx < entries.length - 1 ? ", " : ""}
                        </span>
                      ));
                    })()
                ) : (
                  <p>No analysed models available.</p>
                )}</p>
                <p><span>Local analysis {
                originalResults.metadata.analyzeNeighborhoods ? 
                "enabled; sphere radius (Å): " + originalResults.metadata.radius
                // + "; sampling interval: " + myData.metadata.interval
                : "disabled"}
                </span></p>
              </div>
            </div>
            {/* Copy link and download buttons */}
            <div className={"flex flex-row gap-2 mt-6"}>
              <DownloadLink />
              <DownloadFile id={jobId} disabled={!canStartSimulation}/>
            </div>
            {/* Analysis results */}
            <div className="mt-6">
              <h1>
                <span className="font-semibold">Analysis results</span>
                <span className="group relative inline-flex cursor-help items-center justify-center ml-2">
                  <span
                    aria-label="What this field does"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                  >
                    ?
                  </span>
                  <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                    By default, results for the first chain of the first model are displayed.
                  </span>
                </span>
              </h1>
              {/* Processed models */}
              <div>
                {/* Model selector */}
                <div>
                  <div>
                    <label>Processed model(s)</label>
                    <span className="group relative inline-flex cursor-help items-center justify-center ml-2">
                      <span
                        aria-label="What this field does"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                      >
                        ?
                      </span>
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                        Select a model to view its processed chains and analysis results. The first model is selected by default and analyzed automatically. Other models become available as previous analyses are completed.
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-row overflow-x-auto gap-2 py-2" style={{ scrollbarWidth: "thin" }}>
                    {originalResults.metadata.models.map((modelNum) => {
                      const modelStatus = originalResults.metadata.resultsStatus?.[modelNum.toString()]?.status;
                      const modelListStatus = getModelListStatus(modelStatus);
                      const modelStatusPresentation = getModelStatusPresentation(modelListStatus);
                      const isModelAccessable = modelStatus && ["running", "completed", "sim_starting", "sim_running", "sim_finished", "sim_analyzing", "sim_completed", "sim_failed"].includes(modelStatus);
                      return (
                        modelStatus && 
                        <div
                          key={"model" + modelNum}
                          className={`w-12 p-2 rounded shadow transition-all flex-shrink-0
                            ${originalResults && isModelAccessable ?
                                "cursor-pointer bg-white" : "cursor-not-allowed bg-gray-200"}
                            ${selectedModel === modelNum ? "border-2 border-moley-darkGreen" : "border border-transparent"
                          } flex items-center justify-center`}
                          onClick={() => isModelAccessable && changeModel(modelNum)}
                          title={isModelAccessable ? "" : "Model is being processed. Results will be available once processing is completed."}
                        >
                          <span>{modelNum}</span>
                          {/* {myData && myData.metadata.resultsStatus && (
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
                          )} */}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Global and fragment results */}
                <div className="overflow-x-auto">
                  <GlobalResultsTable
                    selectedModel={selectedModel}
                    modelMetrics={originalResults.results.modelMetrics} 
                    fragmentMetrics={originalResults.results.fragmentMetrics} 
                    simModelMetrics={simulationResults?.results.modelMetrics}
                    simFragmentMetrics={simulationResults?.results.fragmentMetrics}
                  />
                </div>
              </div>
              {/* Chain selection */}
              <div className="mt-6">
                <div>
                  <label>Processed chain(s) of model {selectedModel || "<x>"}:</label>
                  <span className="group relative inline-flex cursor-help items-center justify-center ml-2">
                    <span
                      aria-label="What this field does"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                    >
                      ?
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                      Select a chain to view analysis results for the selected regions.
                    </span>
                  </span>
                </div>
                <div>
                  {chainsState.map((chain) => {
                    return (
                      <div
                        key={"chain" + chain.name}
                        className={`p-2 bg-white rounded shadow transition-all w-12 flex-shrink-0 flex items-center justify-center
                          ${selectedModel === 0 ? "border border-transparent bg-gray-200 cursor-not-allowed" :
                            "cursor-pointer " +(selectedChain === chain.name ? "border-2 border-moley-darkGreen" : "border border-transparent")} 
                          `}
                        onClick={() => selectedModel !== 0 && setSelectedChain(chain.name)}
                      >
                        <span>{chain.original_name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Line plots of chain quality */}
              <div className="mt-6">
                <div>
                  <label>Local quality line charts (per residue)</label>
                  <span className="group relative inline-flex cursor-help items-center justify-center ml-2">
                    <span
                      aria-label="What this field does"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                    >
                      ?
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                      Display line charts of Clash score, bad bonds, bad angles and suiteness for each residue's neighborhood. Hover a mouse on a point to see the exact value for selected residue.
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <ChainMetricLineChart
                    data={originalResults.results.data}
                    data2={simulationResults?.results.data}
                    selectedChain={selectedChain}
                    selectedScore={QualityScore.CLASH_SCORE}
                  />
                  <ChainMetricLineChart
                    data={originalResults.results.data}
                    data2={simulationResults?.results.data}
                    selectedChain={selectedChain}
                    selectedScore={QualityScore.BAD_BONDS}
                  />
                  <ChainMetricLineChart
                    data={originalResults.results.data}
                    data2={simulationResults?.results.data}
                    selectedChain={selectedChain}
                    selectedScore={QualityScore.BAD_ANGLES}
                  />
                  <ChainMetricLineChart
                    data={originalResults.results.data}
                    data2={simulationResults?.results.data}
                    selectedChain={selectedChain}
                    selectedScore={QualityScore.SUITENESS}
                  />
                </div>
              </div>
              {/* Local quality map */}
              <div className="mt-6">
                <button
                  className="h-auto w-auto px-2 my-2 border text-gray-800 bg-gray-100 text-sm/6 rounded hover:bg-gray-200 hover:text-gray-800"
                  onClick={() => setShowResidueTable(!showResidueTable)}
                  title={"Show or hide local quality map."}
                >
                  {showResidueTable ? "Hide local quality map ▲" : "Show local quality map ▼"}
                </button>
                {showResidueTable && (
                  <div>
                    <div>
                      <label>Local quality map (per residue)</label>
                      <span className="group relative inline-flex cursor-help items-center justify-center ml-2">
                        <span
                          aria-label="What this field does"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                        >
                          ?
                        </span>
                        <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                          Displays local quality score for each residue's neighborhood. Select a metric to color the data accordingly.
                        </span>
                      </span>
                    </div>
                    <div className="overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
                      <ResultsResidueTable
                      key={`residue-table-${selectedModel}`}
                      data={originalResults.results.data}
                      simData={simulationResults?.results.data}
                      analyzeNeighborhood={originalResults.metadata.analyzeNeighborhoods}
                      selectedScore={selectedQualityScoreInResidueTable}
                      setSelectedScore={setQualityScoreInResidueTable}
                      modelStatus={selectedModelStatus}
                      selectedChain={selectedChain}
                      />
                    </div>
                  </div>
                )}
              </div>
              {/* Visualizations */}
              <div className="mt-6">
                <div>
                  <label>Structure visualization (colored by local quality)</label>
                  <span className="group relative inline-flex cursor-help items-center justify-center ml-2">
                      <span
                        aria-label="What this field does"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                      >
                        ?
                      </span>
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                        Displays the 2D and 3D structure colored according to the selected quality score.
                      </span>
                    </span>
                </div>
                {hasSimulationStarted && (
                  <div className="my-3">
                    <div className="flex flex-row gap-2">
                      <button
                        tabIndex={0}
                        onClick={() => setSelectedResultsSource("original")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedResultsSource("original");
                          }
                        }}
                        className={`h-auto w-24 px-2 mt-0 rounded-md text-center text-sm transition focus:outline-none focus:ring-2 focus:ring-moley-darkGreen ${
                          selectedResultsSource === "original"
                            ? "bg-moley-darkGreen text-white"
                            : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                        }`}
                      >
                        Original
                      </button>

                      <button
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
                        className={`w-24 h-auto mt-0 rounded-md px-2 py-1 text-center text-sm transition focus:outline-none focus:ring-2 focus:ring-moley-darkGreen ${
                          selectedResultsSource === "simulation"
                            ? "bg-moley-darkGreen text-white"
                            : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                        } ${!simulationTabEnabled ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="mr-1">Refined</span>
                          {isSimulationInProgress && (
                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                          )}
                        </div>
                      </button>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={comparisonModeMolstar}
                          onChange={() => {
                            if (simulationTabEnabled) {
                              setComparisonModeMolstar(!comparisonModeMolstar);
                            }
                          }}
                          disabled={!simulationTabEnabled}
                          className="cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span className="text-sm">Compare 3D</span>
                      </label>
                    </div>
                  </div>
                )}
                <div className="flex flex-row gap-4 my-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="qualityScore"
                      value={QualityScore.CLASH_SCORE}
                      checked={selectedQualityScore === QualityScore.CLASH_SCORE}
                      onChange={(e) => setQualityScore(e.target.value as QualityScore)}
                      className="cursor-pointer"
                    />
                    <span className="text-sm">Clash Score</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="qualityScore"
                      value={QualityScore.BAD_BONDS}
                      checked={selectedQualityScore === QualityScore.BAD_BONDS}
                      onChange={(e) => setQualityScore(e.target.value as QualityScore)}
                      className="cursor-pointer"
                    />
                    <span className="text-sm">Bad Bonds</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="qualityScore"
                      value={QualityScore.BAD_ANGLES}
                      checked={selectedQualityScore === QualityScore.BAD_ANGLES}
                      onChange={(e) => setQualityScore(e.target.value as QualityScore)}
                      className="cursor-pointer"
                    />
                    <span className="text-sm">Bad Angles</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="qualityScore"
                      value={QualityScore.SUITENESS}
                      checked={selectedQualityScore === QualityScore.SUITENESS}
                      onChange={(e) => setQualityScore(e.target.value as QualityScore)}
                      className="cursor-pointer"
                    />
                    <span className="text-sm">Suiteness</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="qualityScore"
                      value={QualityScore.SUGAR_PUCKER_OUT}
                      checked={selectedQualityScore === QualityScore.SUGAR_PUCKER_OUT}
                      onChange={(e) => setQualityScore(e.target.value as QualityScore)}
                      className="cursor-pointer"
                    />
                    <span className="text-sm">Sugar Pucker Outlier</span>
                  </label>
                </div>
                <div className="flex flex-col md:flex-row h-[60vh] min-h-[400px]">
                  <div className="w-full md:w-1/2 h-full relative border border-gray-300" ref={fornaContainerRef}>
                    {/* Gear icon button */}
                    <button
                      onClick={() => setShowFornaSettings(!showFornaSettings)}
                      className="absolute top-5 right-5 z-20 px-2 py-1 bg-white rounded-lg shadow hover:bg-gray-100 transition text-lg w-fit"
                      title="Toggle Forna settings"
                    >
                      ⚙️
                    </button>

                    {/* Download button */}
                    <button
                      onClick={handleDownloadFornaView}
                      className="absolute top-5 right-16 z-20 px-2 py-1 bg-white rounded-lg shadow hover:bg-gray-100 transition text-lg w-fit"
                      title="Download Forna view as image"
                    >
                      ⬇️
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
                      structures={displayedResults?.annotation.map((a) => a.dotbracket) || originalResults.annotation.map((a) => a.dotbracket)}
                      sequences={displayedResults?.annotation.map((a) => a.sequnece) || originalResults.annotation.map((a) => a.sequnece)}
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
                      job={displayedResults || originalResults}
                      colorGnodes={colorGnodes}
                    />
                  </div>
                  <div className="w-full md:w-1/2 h-full">
                    <Molstar
                      key={`molstar-${selectedModel}-${selectedResultsSource}`}
                      useInterface={true}
                      file={comparisonModeMolstar ? originalResults.pdb_file_string : displayedResults?.pdb_file_string || originalResults.pdb_file_string}
                      chains={chainsState}
                      setChains={setChainsState}
                      initialized={initialized}
                      setInitialized={setInitialized}
                      resultResidues={comparisonModeMolstar ? originalResults.results.data : displayedResults?.results.data || originalResults.results.data}
                      selectedQualityScore={selectedQualityScore}
                      radius={originalResults.metadata.radius}
                      comparisonFile={simulationTabEnabled && simulationResults ? simulationResults.pdb_file_string : undefined}
                      comparisonMode={comparisonModeMolstar}
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* Correct the structure */}
            <div className="my-6">
              <div className="flex flex-row items-center gap-x-4">
                <button
                  role="button"
                  tabIndex={canStartSimulation ? 0 : -1}
                  disabled={!canStartSimulation}
                  onClick={() => {
                    if (!canStartSimulation) return;
                    setSimulationStartError(null);
                    setIsSimulationModalOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (!canStartSimulation) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSimulationStartError(null);
                      setIsSimulationModalOpen(true);
                    }
                  }}
                  className="rounded-md mt-0 px-1 py-2 bg-moley-darkGreen text-sm font-semibold text-white shadow-xs hover:bg-moley-green focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  title={canStartSimulation ? "Run a refinement simulation to correct structural geometry based on user-defined parameters." : "Structure correction is available after the analysis is completed."}
                >
                  Run refinement
                </button>
                {hasSimulationStarted &&
                  <div>
                    <span className={`w-48 inline-block rounded-full px-2 py-2 text-xs text-center ${simulationStatusPresentation.className || "bg-gray-300 text-black"}`}>
                      {simulationStatusPresentation.label || "No simulation"}
                    </span>
                  </div>
                }
              </div>

              
            </div>
          </div>
          <Footer />
        </div>
      </div>
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
