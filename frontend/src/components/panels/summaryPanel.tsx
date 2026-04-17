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
import ResultsResidueTable from "../visualizations/ResultsResidueTable";
import GlobalResultsTable from "../visualizations/GlobalResultsTable";
import SimulationStartModal, { SimulationFormValues } from "./SimulationStartModal";

const SummaryPanel: React.FC = () => {
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
  const [directionArrows, setDirectionArrows] = useState(false);
  const [animation, setAnimation] = useState(false);
  const [showRangeDetails, setshowRangeDetails] = useState(false);
  const [showDisplayOptions, setshowDisplayOptions] = useState(false);
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
  const hasStoppedLoading = useRef(false);

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
    // if (myData.results.mode === "fragment" || myData.results.mode === "full") {
      //@ts-ignore
      const nodes = d3.selectAll("circle.fornac-node");
      nodes.style("fill", "white");
    // }
    myData.results.data.forEach((residue) => {
      try {
        //@ts-ignore
        const node = d3.select(
          `circle.fornac-node[node_num="${residue.residue_number}"]`
        );
        if (!node.empty()) {
          node
            .classed("fornac-selectedNode", true)
            .style("fill", getColor(residue, selectedQualityScore));
        // } else if (!node.empty() && myData.results.mode === "fragment") {
        //   //@ts-ignore

        //   node.classed("fornac-selectedNode", true).style("fill", "#6fc2d3");
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
    directionArrows,
    setAnimation,
    selectedQualityScore,
    myData,
  ]);

  const getColorMap = () => {
    if (!myData || !myData.results || !myData.results.data) {
      console.error("No data in myData.results.data");
      return <ErrorPage />;
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
        const response = await fetchMyData(jobId, selectedModel);
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
              data.metadata.status === "running" &&
              data.results &&
              isLoading &&
              !hasStoppedLoading.current
            ) {
              console.log("stop loading ", isLoading);
              setInitialQualityScore(data);
              setIsLoading(false);
              hasStoppedLoading.current = true;
            }
            if (data.metadata.status === "completed") {
              if (isLoading) setInitialQualityScore(data);
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
  }, [jobId, selectedModel]);

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
        !["running", "completed"].includes(myData.metadata.resultsStatus[modelNum.toString()].status)
      ) {
        return;
      }
      setInitialized(false);
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
      <div className="sticky top-0 z-50 bg-white">
        <TopPanel page="Results Panel"/>
      </div>
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
              </div>
              {/* Tabs */}
              <div className="flex mb-4">
                <div
                  className={`flex-1 py-2 rounded-tl-lg text-center ${sidebarTab === 0 ? "bg-white font-bold shadow" : "bg-moley-backgroundLightGreen"}`}
                  onClick={() => setSidebarTab(0)}
                >
                  Models
                </div>
                <div
                  className={`flex-1 py-2 rounded-tr-lg text-center ${sidebarTab === 1 ? "bg-white font-bold shadow" : "bg-moley-backgroundLightGreen"}`}
                  onClick={() => setSidebarTab(1)}
                >
                  Settings
                </div>
              </div>
              {/* Inside tabs */}
              
              {sidebarTab === 0 && (
                <>
                  {Array.from({ length: myData.metadata.model_count }, (_, i) => {
                    const modelNum = i + 1;
                    return (
                      <div
                        key={"model" + modelNum}
                        className={`mb-4 p-2 bg-white rounded shadow transition-all
                          ${myData && myData.metadata.resultsStatus && ["created", "starting"].includes(myData.metadata.resultsStatus[modelNum].status) ?
                              "cursor-not-allowed" : "cursor-pointer"}
                          ${selectedModel === modelNum ? "border-2 border-moley-darkGreen" : "border border-transparent"
                        } flex items-center justify-between`}
                        onClick={() => changeModel(modelNum)}
                      >
                        <span>Model {modelNum}</span>
                        {myData && myData.metadata.resultsStatus && (
                          <div className="flex flex-col items-end">
                            <span
                              className={`ml-2 p-2 rounded-full inline-block
                                ${["created", "starting"].includes(myData.metadata.resultsStatus[modelNum].status) ?
                              "bg-yellow-300 text-black" :
                              myData.metadata.resultsStatus[modelNum].status === "running" ? "bg-blue-500 text-white" :
                              myData.metadata.resultsStatus[modelNum].status === "completed" ? "bg-green-600 text-white" :
                              myData.metadata.resultsStatus[modelNum].status === "failed" ? "bg-red-500 text-white" : ""}`}
                              title={myData.metadata.resultsStatus[modelNum].status}
                            >{["created", "starting"].includes(myData.metadata.resultsStatus[modelNum].status) ?
                              "Queued" :
                              myData.metadata.resultsStatus[modelNum].status === "running" ? "Running" :
                              myData.metadata.resultsStatus[modelNum].status === "completed" ? "Completed" :
                              myData.metadata.resultsStatus[modelNum].status === "failed" ? "Failed" : ""}
                            </span>
                            {myData.metadata.resultsStatus[modelNum].status === "failed" && (
                              <div className="text-red-500 text-sm mt-1">${myData.metadata.resultsStatus[modelNum].error_message}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
              {/* Fornac group */}
              {sidebarTab === 1 && (
              <>
                <div className="mb-4 p-2 bg-white rounded shadow">
                  <h3 className="font-bold mb-2">Fornac settings</h3>
                  <div className="flex flex-col gap-2">
                    <label>
                      <input
                        type="checkbox"
                        checked={numbering}
                        onChange={e => setNumbering(e.target.checked)}
                        className="mr-2"
                      />
                      Numbering
                    </label>
                    {numbering && (
                      <div className="mb-2">
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
                    <label>
                      <input
                        type="checkbox"
                        checked={nodeOutline}
                        onChange={e => setNodeOutline(e.target.checked)}
                        className="mr-2"
                      />
                      Node outline
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={nodeLabel}
                        onChange={e => setNodeLabel(e.target.checked)}
                        className="mr-2"
                      />
                      Node label
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={directionArrows}
                        onChange={e => setDirectionArrows(e.target.checked)}
                        className="mr-2"
                      />
                      Direction arrows
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={links}
                        onChange={e => setLinks(e.target.checked)}
                        className="mr-2"
                      />
                      Show connectivity
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={showClashes}
                        onChange={e => setShowClashes(e.target.checked)}
                        className="mr-2"
                      />
                      Show Clashes
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={animation}
                        onChange={e => setAnimation(e.target.checked)}
                        className="mr-2"
                      />
                      Animation
                    </label>
                  </div>
                </div>
              </>)}
            </div>
            <div className="mt-3 rounded-lg bg-white p-3 shadow">
              <button
                type="button"
                onClick={() => {
                  setSimulationStartError(null);
                  setSimulationStartSuccess(null);
                  setIsSimulationModalOpen(true);
                }}
                className="w-full rounded-lg bg-moley-darkGreen px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
              >
                Correct the structure
              </button>
              {simulationStartSuccess && (
                <p className="mt-2 text-sm text-green-700">{simulationStartSuccess}</p>
              )}
              {simulationStartError && (
                <p className="mt-2 text-sm text-red-700">{simulationStartError}</p>
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
                data={myData.results.data}
                analyzeNeighborhood={myData.metadata.analyzeNeighborhoods}
                selectedScore={selectedQualityScore}
                setSelectedScore={setQualityScore}
                />
              </div>
            </div>
            <div className="flex flex-row h-[60vh] min-h-[400px]">
              <div className="w-1/2 h-full p-5">
                <FornacSummaryComponent
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
                  directionArrows={directionArrows}
                  setAnimation={animation}
                  job={myData}
                  colorGnodes={colorGnodes}
                />
              </div>
              <div className="w-1/2 h-full p-5">
                {getColorMap()}
                <Molstar
                  key={JSON.stringify(myData.results.data)}
                  useInterface={true}
                  file={myData.pdb_file_string}
                  chains={chainsState}
                  setChains={setChainsState}
                  initialized={initialized}
                  setInitialized={setInitialized}
                  resultResidues={myData.results.data}
                  selectedQualityScore={selectedQualityScore}
                />
              </div>
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
