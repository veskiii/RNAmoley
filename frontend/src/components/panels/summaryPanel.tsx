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
import { getColor, getColorErrorFocused } from "../utils/ColorUtils";
import { transformJobToChains } from "../utils/transformJobToChains";
import { fetchMyData, startSimulation } from "../utils/api";
import TopPanel from "../common/topPanel";
import Footer from "../common/footerComponent";
import ResultsResidueTable from "../visualizations/ResultsResidueTable";
import GlobalResultsTable from "../visualizations/GlobalResultsTable";
import ResultsComparisonTable from "../visualizations/ResultsComparisonTable";
import ChainMetricLineChart, { hasChainMetricLineChartValues } from "../visualizations/ChainMetricLineChart";
import SimulationStartModal, { SimulationFormValues } from "./SimulationStartModal";
import { formatNumberForDisplay } from "../utils/displayUniform";
import { get } from "http";
import { colorMapByRange, rangeMap } from "../utils/ColorUtils";

type ColorLegendEntry = {
  label: string;
  color: string;
  borderClassName?: string;
};

const qualityScoreLegendLabels: Partial<Record<QualityScore, string>> = {
  [QualityScore.CLASH_SCORE]: "Clash Score",
  [QualityScore.BAD_BONDS]: "Bad Bonds",
  [QualityScore.BAD_ANGLES]: "Bad Angles",
  [QualityScore.SUITENESS]: "Suiteness",
};

const formatLegendBound = (value: number) => (value === Infinity ? "∞" : `${value}`);

const formatRangeLabel = ([start, end]: [number, number]) =>
  end === Infinity ? `${formatLegendBound(start)}+` : `${formatLegendBound(start)} - ${formatLegendBound(end)}`;

const getColorLegendEntries = (qualityScore: QualityScore, errorFocusedMode: boolean): ColorLegendEntry[] => {
  if (errorFocusedMode) {
    return [
      { label: "Serious error", color: "#ff8c42" },
      { label: "No serious error", color: "#ffffff", borderClassName: "border-gray-300" },
    ];
  }

  if (qualityScore === QualityScore.SUGAR_PUCKER_OUT) {
    return [
      { label: "No outlier", color: colorMapByRange.get(1) || "#ffffff" },
      { label: "Outlier", color: colorMapByRange.get(5) || "#ffffff" },
    ];
  }

  const legendLabel = qualityScoreLegendLabels[qualityScore];
  const ranges = legendLabel ? rangeMap.get(legendLabel)?.ranges ?? [] : [];
  const isSuiteness = qualityScore === QualityScore.SUITENESS;

  if (ranges.length === 5) {
    return ranges.map((range, index) => ({
      label: formatRangeLabel(range),
      color: colorMapByRange.get(isSuiteness ? 5 - index : index + 1) || "#ffffff",
      borderClassName: index === 0 ? "border-gray-300" : undefined,
    }));
  }

  if (ranges.length === 3) {
    const colorOrder = isSuiteness ? [5, 3, 1] : [1, 3, 5];

    return [0, 2, 4].map((colorIndex, index) => ({
      label: formatRangeLabel(ranges[index]),
      color: colorMapByRange.get(colorOrder[index]) || "#ffffff",
      borderClassName: index === 0 ? "border-gray-300" : undefined,
    }));
  }

  return [];
};

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
  const fornaInitialTransformRef = useRef<string | null>(null);
  const fornaContainerRef = useRef<HTMLDivElement>(null);
  const clashChartRef = useRef<HTMLDivElement | null>(null);
  const badBondsChartRef = useRef<HTMLDivElement | null>(null);
  const badAnglesChartRef = useRef<HTMLDivElement | null>(null);
  const suitenessChartRef = useRef<HTMLDivElement | null>(null);
  const failureCountRef = useRef(0);
  const pollIntervalRef = useRef(10000); // milliseconds
  const MAX_RETRIES = 3;
  const BACKOFF_FACTOR = 2;
  const MAX_POLL_INTERVAL = 60000;
  const [showResidueTable, setShowResidueTable] = useState(false);
  const [comparisonModeMolstar, setComparisonModeMolstar] = useState(false);
  const [errorFocusedModeMolstar, setErrorFocusedModeMolstar] = useState(false);

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
      return { label: "Created", className: "text-sm font-bold text-gray-800" };
    }

    if (status === "starting") {
      return { label: "Starting", className: "text-sm font-bold text-gray-800" };
    }

    if (status === "running") {
      return {
        label: "Running",
        className: "text-sm font-bold text-gray-800",
      };
    }

    if (status === "completed") {
      return { label: "Completed", className: "text-sm font-bold text-gray-800" };
    }

    if (status === "failed") {
      return { label: "Failed", className: "text-sm font-bold text-red-600" };
    }

    if (status === "sim_starting") {
      return { label: "Refinement starting...", className: "text-sm font-bold text-gray-800" };
    }

    if (status === "sim_running") {
      return { label: "Refinement in progress...", className: "text-sm font-bold text-gray-800" };
    }

    if (status === "sim_finished") {
      return { label: "Refinement done...", className: "text-sm font-bold text-gray-800" };
    }

    if (status === "sim_analyzing") {
      return { label: "Analyzing results...", className: "text-sm font-bold text-gray-800" };
    }

    if (status === "sim_completed") {
      const simParams = simulationResults?.metadata.simulations?.[selectedModel]?.parameters;
      return { label: `Refinement completed`, className: "text-sm font-bold text-gray-800", parameters: simParams };
    }

    if (status === "sim_failed") {
      return { label: "Refinement failed", className: "text-sm font-bold text-red-500" };
    }

    return { label: status, className: "text-sm font-bold text-gray-800" };
  };

  const getLabelForSimulationParameter = (paramName: string) => {
    switch (paramName) {
      case "restraintBackboneForce":
        return "Backbone restraint force";
      case "restraintGlobalForce":
        return "Global restraint force";
      case "restraintBasePairsForce":
        return "Base pairs restraint force";
      case "rmsdCutoff":
        return "RMSD cutoff";
      default:
        return null;
    }
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

  const getColorForForna = (residue: any) => {
    if (!errorFocusedModeMolstar) {
      return residue.selected ? getColor(residue, selectedQualityScore) : "#7c7c7c";
    }
    else {
      return residue.selected ? getColorErrorFocused(residue, selectedQualityScore) : "#7c7c7c";
    }
  }

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
            .style("fill", getColorForForna(residue));
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
    let timeout: NodeJS.Timeout | null = null;
    let cancelled = false;

    async function fetchData() {
      try {
        // Always fetch original results so originalResults holds only the original data
        console.log(`Fetching original results for job ${jobId}, model ${selectedModel}`);
        const origResponse = await fetchMyData(jobId, selectedModel, "original");
        const origData = await origResponse.json();

        // On successful fetch, reset failure counter and poll interval
        failureCountRef.current = 0;
        pollIntervalRef.current = 10000;

        if (!origResponse.ok) {
          // Treat non-ok as a failure but allow retries up to MAX_RETRIES
          failureCountRef.current += 1;
          if (failureCountRef.current >= MAX_RETRIES) {
            setMyError({
              errorMessage: origData?.error || origData?.message || 'Failed to fetch data',
              statusCode: origResponse.status.toString(),
            });
            cancelled = true;
            if (timeout) clearTimeout(timeout);
            return;
          }
          // Back off before next retry
          pollIntervalRef.current = Math.min(pollIntervalRef.current * BACKOFF_FACTOR, MAX_POLL_INTERVAL);
        } else {
          setOriginalResults((prevData) => {
            if (JSON.stringify(prevData) !== JSON.stringify(origData)) {
              const chains = transformJobToChains(origData);

              setChainsState((prevChains) => {
                if (JSON.stringify(prevChains) !== JSON.stringify(chains)) {
                  setSelectedChain((prevSelected) => {
                    if (prevSelected && chains.some((c) => c.name === prevSelected)) {
                      return prevSelected;
                    }
                    // Prefer the first chain that is listed for the selected model in resultsStatus
                    const availableForModel: string[] | undefined = origData?.metadata?.resultsStatus?.[selectedModel?.toString() || ""]?.chains;
                    const defaultChain = chains.find((c) => !availableForModel || availableForModel.includes(c.name))?.name || "";
                    return defaultChain;
                  });
                  return chains;
                }
                return prevChains;
              });

              return origData;
            }
            return prevData;
          });

          if (origData.metadata.status === "failed") {
            setMyError({
              errorMessage: origData.metadata.error_message,
              statusCode: "500",
            });
            cancelled = true;
            if (timeout) clearTimeout(timeout);
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
            cancelled = true;
            if (timeout) clearTimeout(timeout);
            setIsLoading(false);
          }
        }

        // If simulation tab is enabled, fetch simulation results separately and store them in simulationResults
        if (simulationTabEnabled) {
          try {
            console.log(`Fetching simulation results for job ${jobId}, model ${selectedModel}`);
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
        else {
          setSimulationResults(undefined);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        // Increment failure counter and backoff
        failureCountRef.current += 1;
        if (failureCountRef.current >= MAX_RETRIES) {
          setMyError({
            errorMessage: (error as any)?.message || "Failed to fetch data",
            statusCode: "500",
          });
          cancelled = true;
          if (timeout) clearTimeout(timeout);
          return;
        }

        pollIntervalRef.current = Math.min(pollIntervalRef.current * BACKOFF_FACTOR, MAX_POLL_INTERVAL);
      } finally {
        // Schedule next fetch only if not cancelled
        if (!cancelled) {
          timeout = setTimeout(fetchData, pollIntervalRef.current);
        }
      }
    }

    // Start polling
    fetchData();

    // Cleanup when component unmounts or dependencies change
    return () => {
      if (timeout) clearTimeout(timeout);
      // Reset counters so next effect run starts fresh
      failureCountRef.current = 0;
      pollIntervalRef.current = 10000;
    };
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
      setSimulationStartError("No job id.");
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
        simOnlyFragment: values.simOnlyFragment,
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

    const nameForQualityScore =
    {
      [QualityScore.CLASH_SCORE]: "ClashScore",
      [QualityScore.BAD_ANGLES]: "BadAngles",
      [QualityScore.BAD_BONDS]: "BadBonds",
      [QualityScore.SUITENESS]: "Suiteness",
      [QualityScore.SUGAR_PUCKER_OUT]: "SugarPucker",
    }

    try {
      const svg = fornaContainerRef.current.querySelector("#rna_ss svg") as SVGSVGElement | null;

      if (svg) {
        const clone = svg.cloneNode(true) as SVGSVGElement;
        const sourceGroup = clone.querySelector("g") as SVGGElement | null;
        const fallbackWidth = clone.viewBox?.baseVal?.width || clone.width?.baseVal?.value || clone.clientWidth || 800;
        const fallbackHeight = clone.viewBox?.baseVal?.height || clone.height?.baseVal?.value || clone.clientHeight || 600;

        // Compute bbox from an untransformed copy so pan/zoom transforms don't affect the bounds
        const temp = clone.cloneNode(true) as SVGSVGElement;
        // Only remove transform from the top-level group (pan/zoom), keep nested transforms
        const tempRoot = temp.querySelector("g") as SVGGElement | null;
        if (tempRoot) {
          try {
            tempRoot.removeAttribute("transform");
          } catch (e) {
            // ignore
          }
        }
        let box = tempRoot?.getBBox();
        if (!box || !Number.isFinite(box.x) || !Number.isFinite(box.y) || !Number.isFinite(box.width) || !Number.isFinite(box.height) || box.width <= 0 || box.height <= 0) {
          box = { x: 0, y: 0, width: fallbackWidth, height: fallbackHeight } as DOMRect;
        }

        const padding = 40;
        const viewBoxWidth = Math.max(1, box.width + padding * 2);
        const viewBoxHeight = Math.max(1, box.height + padding * 2);

        // Create a fresh wrapper SVG that positions the Forna content at positive coordinates
        const ns = "http://www.w3.org/2000/svg";
        const wrapperSvg = document.createElementNS(ns, "svg") as SVGSVGElement;
        wrapperSvg.setAttribute("xmlns", ns);
        wrapperSvg.setAttribute("width", `${Math.round(viewBoxWidth)}`);
        wrapperSvg.setAttribute("height", `${Math.round(viewBoxHeight)}`);
        wrapperSvg.setAttribute("viewBox", `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
        wrapperSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        wrapperSvg.style.background = "#ffffff";

        const contentGroup = document.createElementNS(ns, "g");
        // Translate content so that bbox's top-left maps to padding,padding
        contentGroup.setAttribute("transform", `translate(${ -box.x + padding }, ${ -box.y + padding })`);

        // Remove transform only from the top-level group in the clone (pan/zoom)
        const cloneRoot = clone.querySelector("g") as SVGGElement | null;
        if (cloneRoot) {
          try {
            cloneRoot.removeAttribute("transform");
          } catch (e) {
            // ignore
          }
        }

        // Move all children from cloned svg into the content group
        while (clone.firstChild) {
          contentGroup.appendChild(clone.firstChild);
        }

        // If we have an initial transform captured from Forna, apply it as an outer group
        const initialTransform = fornaInitialTransformRef.current;
        let outerGroup: SVGGElement | null = null;
        let appliedScale = 1;
        if (initialTransform) {
          outerGroup = document.createElementNS(ns, "g");
          try {
            outerGroup.setAttribute("transform", initialTransform);
            // extract scale from transform string
            const scaleMatch = /scale\(([-0-9.]+)\)/.exec(initialTransform);
            if (scaleMatch) {
              appliedScale = parseFloat(scaleMatch[1]) || 1;
            }
          } catch (e) {
            // ignore
          }
        }

        if (outerGroup) {
          outerGroup.appendChild(contentGroup);
          wrapperSvg.appendChild(outerGroup);
        } else {
          wrapperSvg.appendChild(contentGroup);
        }

        // If an initial scale is applied, reflect that in the exported pixel size
        if (appliedScale && appliedScale !== 1) {
          wrapperSvg.setAttribute("width", `${Math.round(viewBoxWidth * appliedScale)}`);
          wrapperSvg.setAttribute("height", `${Math.round(viewBoxHeight * appliedScale)}`);
        }

        const wrapper = document.createElement("div");
        wrapper.style.position = "fixed";
        wrapper.style.left = "-10000px";
        wrapper.style.top = "0";
        wrapper.style.background = "#ffffff";
        wrapper.appendChild(wrapperSvg);
        document.body.appendChild(wrapper);

        try {
          const exportWidth = Math.max(1, Math.round(viewBoxWidth * (appliedScale || 1)));
          const exportHeight = Math.max(1, Math.round(viewBoxHeight * (appliedScale || 1)));

          const canvas = await html2canvas(wrapper, {
            backgroundColor: "#ffffff",
            scale: 2,
            useCORS: true,
            width: exportWidth,
            height: exportHeight,
            windowWidth: exportWidth,
            windowHeight: exportHeight,
            scrollX: 0,
            scrollY: 0,
          });

          const link = document.createElement("a");
          link.href = canvas.toDataURL("image/png");
          link.download = `${originalResults.name || "forna-structure"}-m${selectedModel}-2D-${nameForQualityScore[selectedQualityScore] || selectedQualityScore}.png`;
          link.click();
        } finally {
          wrapper.remove();
        }
        return;
      }

      const canvas = await html2canvas(fornaContainerRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${originalResults.name || "forna-structure"}-m${selectedModel}-2D-${nameForQualityScore[selectedQualityScore] || selectedQualityScore}.png`;
      link.click();
    } catch (error) {
      console.error("Failed to download Forna view:", error);
    }
  };

  const downloadChartContainerAsPng = async (container: HTMLElement | null | undefined, filename: string, scale = 2) => {
    if (!container) return;
    try {
      const chartFontFamily = getComputedStyle(container).fontFamily || getComputedStyle(document.body).fontFamily || "sans-serif";
      const escapeXmlAttr = (value: string) =>
        value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&apos;");
      const safeChartFontFamily = escapeXmlAttr(chartFontFamily);
      const svgElements = Array.from(container.querySelectorAll("svg")) as SVGSVGElement[];
      const hasComparisonLegend = Array.from(container.querySelectorAll("div")).some((element) => {
        const text = element.textContent || "";
        return text.includes("Original") && text.includes("After refinement");
      });

      const getSvgSize = (svg: SVGSVGElement) => {
        const viewBox = svg.viewBox?.baseVal;
        if (viewBox && viewBox.width && viewBox.height) {
          return { width: viewBox.width, height: viewBox.height };
        }

        const width = svg.width?.baseVal?.value || svg.clientWidth || parseFloat(svg.getAttribute("width") || "0") || 0;
        const height = svg.height?.baseVal?.value || svg.clientHeight || parseFloat(svg.getAttribute("height") || "0") || 0;
        return { width, height };
      };

      const serializeSvg = (svg: SVGSVGElement) => {
        const serializer = new XMLSerializer();
        let source = serializer.serializeToString(svg);
        if (!source.match(/^<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/)) {
          source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        if (!source.match(/^<svg[^>]+xmlns:xlink="http:\/\/www.w3.org\/1999\/xlink"/)) {
          source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
        }
        return source;
      };

      const stripOuterSvg = (source: string) => source.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

      const createPngFromSvg = async (svgMarkup: string, width: number, height: number) => {
        const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        try {
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Failed to load SVG for export"));
            img.src = url;
          });

          const canvas = document.createElement("canvas");
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("Canvas 2D context is unavailable");
          }

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const a = document.createElement("a");
          a.href = canvas.toDataURL("image/png");
          a.download = `${filename}.png`;
          a.click();
        } finally {
          URL.revokeObjectURL(url);
        }
      };

      if (svgElements.length >= 2) {
        const orderedSvgs = svgElements
          .map((svg) => ({ svg, size: getSvgSize(svg) }))
          .sort((left, right) => left.size.width - right.size.width);

        const leftSvg = orderedSvgs[0]?.svg;
        const contentSvg = orderedSvgs[orderedSvgs.length - 1]?.svg;

        if (leftSvg && contentSvg && leftSvg !== contentSvg) {
          const leftSource = serializeSvg(leftSvg);
          const contentSource = serializeSvg(contentSvg);
          const leftInner = stripOuterSvg(leftSource);
          const contentInner = stripOuterSvg(contentSource);
          const leftSize = getSvgSize(leftSvg);
          const contentSize = getSvgSize(contentSvg);
          const totalWidth = Math.max(1, leftSize.width + contentSize.width);
          const legendHeight = hasComparisonLegend ? 52 : 0;
          const totalHeight = Math.max(
            leftSize.height || contentSize.height || 1,
            contentSize.height || leftSize.height || 1,
          ) + legendHeight;

          const legendMarkup = hasComparisonLegend
            ? `<g transform="translate(${Math.max(totalWidth - 170, 8)},16)"><rect x="0" y="0" width="162" height="34" rx="8" fill="#ffffff" fill-opacity="0.95" stroke="#e5e7eb"/><circle cx="14" cy="12" r="5" fill="#fb923c"/><text x="26" y="16" fill="#374151" font-size="12" font-family="${safeChartFontFamily}">Original</text><circle cx="14" cy="26" r="5" fill="#60a5fa"/><text x="26" y="30" fill="#374151" font-size="12" font-family="${safeChartFontFamily}">After refinement</text></g>`
            : "";

          const wrapper = `<?xml version="1.0" encoding="utf-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" style="font-family: ${safeChartFontFamily};"><rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="#ffffff" /><g transform="translate(0,${legendHeight})">${leftInner}</g><g transform="translate(${leftSize.width},${legendHeight})">${contentInner}</g>${legendMarkup}</svg>`;
          await createPngFromSvg(wrapper, totalWidth, totalHeight);
          return;
        }
      }

      if (svgElements.length === 1) {
        const svg = svgElements[0];
        const size = getSvgSize(svg);
        const source = serializeSvg(svg);
        await createPngFromSvg(source, Math.max(size.width, 1), Math.max(size.height, 1));
        return;
      }

      const fullWidth = Math.max(container.scrollWidth, container.clientWidth, 1);
      const fullHeight = Math.max(container.scrollHeight, container.clientHeight, 1);
      const canvas = await html2canvas(container, {
        backgroundColor: "#ffffff",
        scale,
        useCORS: true,
        width: fullWidth,
        height: fullHeight,
        windowWidth: fullWidth,
        windowHeight: fullHeight,
        scrollX: 0,
        scrollY: 0,
      });

      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.png`;
      a.click();
    } catch (err) {
      console.error("html2canvas failed for chart container:", err);
      // fallback to SVG combination if available
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

  // Available chains for the currently selected model (used in JSX below)
  const availableChains: string[] | undefined = originalResults?.metadata?.resultsStatus?.[selectedModel?.toString() || ""]?.chains;
  const showClashChart =
    !!originalResults?.metadata.analyzeNeighborhoods &&
    hasChainMetricLineChartValues(originalResults.results.data, simulationResults?.results.data, selectedChain, QualityScore.CLASH_SCORE);
  const showBadBondsChart =
    !!originalResults?.metadata.analyzeNeighborhoods &&
    hasChainMetricLineChartValues(originalResults.results.data, simulationResults?.results.data, selectedChain, QualityScore.BAD_BONDS);
  const showBadAnglesChart =
    !!originalResults?.metadata.analyzeNeighborhoods &&
    hasChainMetricLineChartValues(originalResults.results.data, simulationResults?.results.data, selectedChain, QualityScore.BAD_ANGLES);
  const showSuitenessChart = hasChainMetricLineChartValues(originalResults.results.data, simulationResults?.results.data, selectedChain, QualityScore.SUITENESS);

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
                {originalResults.metadata.containsNonRNA &&
                  <p>
                    <span className="text-green-600">Note: The input structure contains non-RNA components; results are reported for RNA only.</span>
                  </p>
                }
              </div>
            </div>
            {/* Copy link and download buttons */}
            <div className={"flex flex-row gap-2 mt-6 items-center"}>
              <DownloadLink />
              <DownloadFile id={jobId} disabled={!canStartSimulation}/>
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
                {hasSimulationStarted && (
                  <div className="flex items-center gap-2">
                    <span className={`py-2 ${simulationStatusPresentation.className || "bg-gray-300 text-black"}`}>
                      {simulationStatusPresentation.label || "No simulation"}
                    </span>
                    {(() => {
                      const simulationParameters = simulationStatusPresentation.parameters;
                      if (!simulationParameters) return null;
                      return null;
                    })()}
                  </div>
                )}
              </div>
              {!canStartSimulation && !hasSimulationStarted && (
                <p className="text-sm font-bold">
                  Analysis in progress...
                </p>
              )}
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
                <div className="overflow-x-auto border border-gray-100 shadow-md rounded p-2">
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
                <div className="flex flex-row overflow-x-auto gap-2 py-2" style={{ scrollbarWidth: "thin" }}>
                  {chainsState
                    .filter((chain) => !availableChains || availableChains.includes(chain.name))
                    .map((chain) => (
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
                    ))}
                </div>
              </div>
              {/* Simulation results comparison table */}
              {simulationResults && (
                <div className="mt-4">
                  <ResultsComparisonTable
                    referenceData={originalResults}
                    comparisonData={simulationResults}
                    simulationParameters={simulationStatusPresentation.parameters
                      ? Object.entries(simulationStatusPresentation.parameters).map(([param, value]) => ({
                          label: getLabelForSimulationParameter(param),
                          value,
                        }))
                      : undefined}
                  />
                </div>
              )}
              {/* Residue results table */}
              <div className="mt-6">
                  <div className="border border-gray-100 shadow-md p-4">
                    <div className="flex justify-between">
                      <div>
                        <label className="font-medium">Local quality table (per residue)</label>
                        <span className="group relative inline-flex cursor-help items-center justify-center ml-2">
                          <span
                            aria-label="What this field does"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                          >
                            ?
                          </span>
                          <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                            Displays local quality score for each residue's neighborhood.
                          </span>
                        </span>
                      </div>
                      <div
                        onClick={() => setShowResidueTable(!showResidueTable)}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer select-none"
                      >
                        {showResidueTable ? "▲ Hide" : "▼ Show" }
                      </div>
                    </div>
                    
                {showResidueTable && (
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
                    
                )}
                  </div>
              </div>
              {/* Line plots of chain quality */}
              <div className="mt-6 border border-gray-100 shadow-md rounded p-4">
                <div>
                  <label className="font-medium">Local quality line charts (per residue)</label>
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
                <div className={`grid grid-cols-1 ${originalResults.metadata.analyzeNeighborhoods ? 'md:grid-cols-2' : ''} gap-2`}>
                  {showClashChart && (
                  <div className="relative" ref={clashChartRef as any}>
                    <button
                      onClick={() => {
                          const container = clashChartRef.current as HTMLElement | null;
                          if (!container) return;
                          downloadChartContainerAsPng(container, `${originalResults.name || "chart"}-m${selectedModel}-ClashScore`);
                        }}
                      className="absolute top-5 left-16 z-20 px-2 py-1 bg-white rounded-lg shadow hover:bg-gray-100 transition text-lg w-fit"
                      title="Download chart as PNG"
                    >
                      ⬇️
                    </button>
                    <ChainMetricLineChart
                      data={originalResults.results.data}
                      data2={simulationResults?.results.data}
                      selectedChain={selectedChain}
                      selectedScore={QualityScore.CLASH_SCORE}
                    />
                  </div>
                  )}
                  {showBadBondsChart && (
                  <div className="relative" ref={badBondsChartRef as any}>
                    <button
                      onClick={() => {
                        const container = badBondsChartRef.current as HTMLElement | null;
                        if (!container) return;
                        downloadChartContainerAsPng(container, `${originalResults.name || "chart"}-m${selectedModel}-BadBonds`);
                      }}
                      className="absolute top-5 left-16 z-20 px-2 py-1 bg-white rounded-lg shadow hover:bg-gray-100 transition text-lg w-fit"
                      title="Download chart as PNG"
                    >
                      ⬇️
                    </button>
                    <ChainMetricLineChart
                      data={originalResults.results.data}
                      data2={simulationResults?.results.data}
                      selectedChain={selectedChain}
                      selectedScore={QualityScore.BAD_BONDS}
                    />
                  </div>
                  )}
                  {showBadAnglesChart && (
                  <div className="relative" ref={badAnglesChartRef as any}>
                    <button
                      onClick={() => {
                        const container = badAnglesChartRef.current as HTMLElement | null;
                        if (!container) return;
                        downloadChartContainerAsPng(container, `${originalResults.name || "chart"}-m${selectedModel}-BadAngles`);
                      }}
                      className="absolute top-5 left-16 z-20 px-2 py-1 bg-white rounded-lg shadow hover:bg-gray-100 transition text-lg w-fit"
                      title="Download chart as PNG"
                    >
                      ⬇️
                    </button>
                    <ChainMetricLineChart
                      data={originalResults.results.data}
                      data2={simulationResults?.results.data}
                      selectedChain={selectedChain}
                      selectedScore={QualityScore.BAD_ANGLES}
                    />
                  </div>
                  )}

                  {showSuitenessChart && (
                  <div className="relative" ref={suitenessChartRef as any}>
                    <button
                      onClick={() => {
                        const container = suitenessChartRef.current as HTMLElement | null;
                        if (!container) return;
                        downloadChartContainerAsPng(container, `${originalResults.name || "chart"}-m${selectedModel}-Suiteness`);
                      }}
                      className="absolute top-5 left-16 z-20 px-2 py-1 bg-white rounded-lg shadow hover:bg-gray-100 transition text-lg w-fit"
                      title="Download chart as PNG"
                    >
                      ⬇️
                    </button>
                    <ChainMetricLineChart
                      data={originalResults.results.data}
                      data2={simulationResults?.results.data}
                      selectedChain={selectedChain}
                      selectedScore={QualityScore.SUITENESS}
                    />
                  </div>
                  )}
                  {!originalResults.metadata.analyzeNeighborhoods && (
                    <p className="">
                      Local analysis was not enabled. To compute clash scores, bad bonds, and bad angles for residue neighborhoods, 
                      enable "Local analysis" during submission.
                    </p>
                  )}
                </div>
              </div>
              {/* Local quality map */}
              
              {/* Visualizations */}
              <div className="my-6 border border-gray-100 shadow-md rounded p-4">
                <div>
                  <label className="font-medium">Structure visualization (colored by local quality)</label>
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
                {hasSimulationStarted && selectedModelStatus !== "sim_failed" && (
                  <div className="my-3">
                    <div className="flex flex-row gap-4 items-center" role="radiogroup" aria-label="Results source">
                      <p>Display structure:</p>
                      <label
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-md py-2 text-sm transition`}
                      >
                        <input
                          type="radio"
                          name="resultsSource"
                          value="original"
                          checked={selectedResultsSource === "original"}
                          onChange={() => setSelectedResultsSource("original")}
                          className="text-sm"
                        />
                        <span>Original</span>
                      </label>

                      <label
                        className={`flex items-center justify-center gap-2 rounded-md py-2 text-sm transition
                           ${!simulationTabEnabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                      >
                        <input
                          type="radio"
                          name="resultsSource"
                          value="simulation"
                          checked={selectedResultsSource === "simulation"}
                          onChange={() => {
                            if (simulationTabEnabled) {
                              setSelectedResultsSource("simulation");
                            }
                          }}
                          disabled={!simulationTabEnabled}
                          className="text-sm"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="mr-1">After refinement</span>
                          {isSimulationInProgress && (
                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                          )}
                        </div>
                      </label>
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
                        <span>
                          <span className="text-sm">Show 3D alignment</span>
                          <span className="group relative inline-flex cursor-help items-center justify-center ml-2">
                            <span
                              aria-label="What this field does"
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                            >
                              ?
                            </span>
                            <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                              Display the aligned original (orange) and post-refinement (blue) structures in the 3D view.
                            </span>
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                )}
                <div className="flex flex-row gap-4 my-3 items-center">
                  <p>Visualization mode:</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="continuosColoring"
                      value={"false"}
                      checked={!errorFocusedModeMolstar}
                      onChange={(e) => setErrorFocusedModeMolstar(e.target.value === "true")}
                      className="cursor-pointer"
                    />
                    <span>
                      <span className="text-sm">Continuous coloring</span>
                      <span className="group relative inline-flex cursor-help items-center justify-center ml-2">
                        <span
                          aria-label="What this field does"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                        >
                          ?
                        </span>
                        <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                          Colors analyzed residues using a continuous green-to-red scale based on the selected metric values. Non-analyzed residues are shown in dark gray.
                        </span>
                      </span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="errorFocused"
                      value={"true"}
                      checked={errorFocusedModeMolstar}
                      onChange={(e) => setErrorFocusedModeMolstar(e.target.value === "true")}
                      className="cursor-pointer"
                    />
                    <span>
                      <span className="text-sm">Error-focused highlighting</span>
                      <span className="group relative inline-flex cursor-help items-center justify-center ml-2">
                        <span
                          aria-label="What this field does"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                        >
                          ?
                        </span>
                        <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                          Highlights analyzed residues with serious structural issues in orange for the selected metric. Non-analyzed residues are dark gray; residues without serious issues are white.
                        </span>
                      </span>
                    </span>
                  </label>
                </div>
                <div className="flex flex-row gap-4 my-3 items-center">
                  <p>Color by:</p>
                  {originalResults.metadata.analyzeNeighborhoods && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="qualityScore"
                      value={QualityScore.CLASH_SCORE}
                      checked={selectedQualityScore === QualityScore.CLASH_SCORE}
                      onChange={(e) => setQualityScore(e.target.value as QualityScore)}
                      className="cursor-pointer"
                    />
                    <span className="text-sm">Clash score</span>
                  </label>
                  )}
                  {originalResults.metadata.analyzeNeighborhoods && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="qualityScore"
                      value={QualityScore.BAD_BONDS}
                      checked={selectedQualityScore === QualityScore.BAD_BONDS}
                      onChange={(e) => setQualityScore(e.target.value as QualityScore)}
                      className="cursor-pointer"
                    />
                    <span className="text-sm">Bad bonds</span>
                  </label>
                  )}
                  {originalResults.metadata.analyzeNeighborhoods && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="qualityScore"
                      value={QualityScore.BAD_ANGLES}
                      checked={selectedQualityScore === QualityScore.BAD_ANGLES}
                      onChange={(e) => setQualityScore(e.target.value as QualityScore)}
                      className="cursor-pointer"
                    />
                    <span className="text-sm">Bad angles</span>
                  </label>
                  )}
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
                    <span className="text-sm">Sugar pucker outlier</span>
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
                      title="Download the 2D structure diagram as a PNG image"
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
                      onInitialTransform={(t) => {
                        fornaInitialTransformRef.current = t;
                      }}
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
                      errorFocusedMode={!comparisonModeMolstar && errorFocusedModeMolstar}
                      comparisonFile={simulationTabEnabled && simulationResults ? simulationResults.pdb_file_string : undefined}
                      comparisonMode={comparisonModeMolstar}
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span>Legend:</span>
                  {getColorLegendEntries(selectedQualityScore, errorFocusedModeMolstar).map((entry) => (
                    <span
                      key={entry.label}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-2 py-1 shadow-sm ring-1 ring-gray-200"
                    >
                      <span
                        className={`h-3 w-3 rounded-full border ${entry.borderClassName || "border-transparent"}`}
                        style={{ backgroundColor: entry.color }}
                        aria-hidden="true"
                      />
                      <span className="text-xs">{entry.label}</span>
                    </span>
                  ))}
                </div>
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
