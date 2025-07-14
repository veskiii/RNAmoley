import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import Loading from "../common/loading";
import "../../App.css";
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
import { fetchMyData } from "../utils/api";
import SmallScreenPage from "../common/smallScreenPage";
import TopPanel from "../common/topPanel";
import ResultsResidueTable from "../visualizations/ResultsResidueTable";
import GlobalResultsTable from "../visualizations/GlobalResultsTable";

const SummaryPanel: React.FC = () => {
  const { jobId } = useParams();
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
        const response = await fetchMyData(jobId);
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
  }, [jobId]);

  const setInitialQualityScore = (data: SummaryJob) => {
    if (data && data.metadata.analyzeNeighborhoods) {
      setQualityScore(QualityScore.CLASH_SCORE);
    } else {
      setQualityScore(QualityScore.SUITENESS);
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
              {/* ...tutaj zawartość sidebar'a... */}
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
                  setAnimation={false}
                  job={myData}
                  colorGnodes={colorGnodes}
                />
              </div>
              <div className="w-1/2 h-full p-5">
                {getColorMap()}
                <Molstar
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
    </div>
  );
};

export default SummaryPanel;
