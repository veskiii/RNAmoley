import React, { useEffect, useState } from "react";
import Loading from "../common/loading";
import "../../App.css";
import Molstar from "../visualizations/molStarComponent";
import FornaComponent from "../visualizations/fornacWrapper";
import { useNavigate, useParams } from "react-router-dom";
import FornaControls from "../common/fornaControls";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Typography from "@mui/material/Typography";
import { SelectChangeEvent } from "@mui/material/Select";
import { Job, Chain, Nucleotide } from "../utils/types";
import { fetchJobData, sendDataToAnalyze } from "../utils/api";
import { transformJobToChains } from "../utils/transformJobToChains";
import { Colors } from "../common/colors";
import HelpIcon from "../common/helpIcon";
import Logo from "../common/logo";
import ErrorPage from "../common/ErrorPage";
import RangeSelecting from "../common/rangeSelecting";
import HomeIcon from "../common/homeIcon";
import SmallScreenPage from "../common/smallScreenPage";
import TopPanel from "../common/topPanel";
import ResidueTable from "../visualizations/ResidueTable";

const Panel: React.FC = () => {
  const [myData, setMyData] = useState<Job>();
  const [error, setError] = useState<string | null>(null);
  const [labelInterval, setLabelInterval] = useState(10);
  const [numbering, setNumbering] = useState(false);
  const [nodeOutline, setNodeOutline] = useState(true);
  const [nodeLabel, setNodeLabel] = useState(true);
  const [links, setLinks] = useState(true);
  const [directionArrows, setDirectionArrows] = useState(false);
  const [animation, setAnimation] = useState(false);
  const [is3Dview, setIs3Dview] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [chainsState, setChainsState] = useState<Chain[]>([]);
  const [selectedModel, setSelectedModel] = useState<number>(1);
  const [analyzeWholeStructure, setAnalyzeWholeStructure] = useState(false);
  const [selectedChain, setSelectedChain] = useState<string>(
    chainsState[0]?.name.slice(-1) || ""
  );
  const [inputValueStart, setInputValueStart] = useState<string>("");
  const [inputValueEnd, setInputValueEnd] = useState<string>("");
  const [minId, setMinId] = useState<string>("");
  const [maxId, setMaxId] = useState<string>("");
  const [selectedList, setSelectedList] = useState<number[]>([]);
  const [isViewInitialized, setIsViewInitialized] = useState<boolean>(true);
  const { jobId } = useParams();
  const jobID = jobId;
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const isDisabled = !(analyzeWholeStructure || selectedList.length > 0);

  useEffect(() => {
    setSelectedChain(chainsState[0]?.name.slice(-1) || "");
  }, [myData]);

  const handleInputChangeStart = (event: SelectChangeEvent) => {
    setInputValueStart(event.target.value);
  };

  const handleInputChangeEnd = (event: SelectChangeEvent) => {
    setInputValueEnd(event.target.value);
  };

  const handleChange = (event: SelectChangeEvent) => {
    setSelectedChain(event.target.value);
  };

  const handleAnalyzeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!analyzeWholeStructure) {
      setSelectedList([]);
      setChainsState((prevChains) => {
        const newChains = prevChains.map((chain) => ({
          ...chain,
          nucleotides: chain.nucleotides.map((nucleotide) => ({
            ...nucleotide,
            selected: false,
          })),
        }));
        return newChains;
      });
    }
    setAnalyzeWholeStructure(e.target.checked);
  };

  //do placeholder z max i min original_id nukleotydów podanego chain
  useEffect(() => {
    chainsState.forEach((chain) => {
      if (chain.name.slice(-1) === selectedChain) {
        const indices = chain.nucleotides.map((nucleotide) => nucleotide.index);
        const min = Math.min(...indices);
        const max = Math.max(...indices);

        setMinId(min.toString());
        setMaxId(max.toString());
        setInputValueStart(min.toString());
        setInputValueEnd(max.toString());
      }
    });
  }, [selectedChain]);

  async function loadData(jobID: string | undefined, model: number = 1) {
    try {
      const data = await fetchJobData(jobID, model);
      setMyData(data);
      const chains = transformJobToChains(data);
      setChainsState(chains);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      }
    }
  }

  function handleNavigate() {
    if (analyzeWholeStructure) {
      const radius = parseInt(
        (document.getElementById("radiusInput") as HTMLInputElement).value
      );
      const interval = parseInt(
        (document.getElementById("intervalInput") as HTMLInputElement).value
      );
      if (radius < 1) {
        alert(
          `Invalid radius value: ${radius}. Enter value greater or equal 1.`
        );
        return;
      } else if (interval < 1) {
        alert(
          `Invalid interval value: ${interval}. Enter value greater or equal 1.`
        );
        return;
      } else {
        sendDataToAnalyze(
          analyzeWholeStructure,
          jobID,
          selectedModel,
          selectedList
        );
        navigate(`/summary/${jobID}`);
      }
    } else {
      sendDataToAnalyze(
        analyzeWholeStructure,
        jobID,
        selectedModel,
        selectedList
      );
      navigate(`/summary/${jobID}`);
    }
  }

  const handleSetSelectedModel = (e: SelectChangeEvent) => {
    setSelectedModel(parseInt(e.target.value));
  };

  const changeModel = (model: number) => {
    if (!jobID || model === selectedModel) return;
    loadData(jobID, model);
  };

  useEffect(() => {
    if (!jobID) return;
    loadData(jobID, 1);
  }, [jobID]);

  useEffect(() => {
    const idList: number[] = chainsState.flatMap((chain) =>
      chain.nucleotides
        .filter((nucleotide) => nucleotide.selected)
        .map((nucleotide) => nucleotide.index)
    );
    setSelectedList(idList);
  }, [chainsState]);

  if (error) return <ErrorPage errorMessage={error} />;
  if (!myData) {
    return <Loading page="Analysis panel" />;
  }
  return (
    <div className="desktop-content h-screen w-screen overflow-hidden">
      {/* Top panel */}
      <div className="sticky top-0 z-50 bg-white">
        <TopPanel />
      </div>

      {/* Side view + Main content */}
      <div className="flex h-full overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 h-full overflow-y-auto">
          <div
            className="flex flex-col h-full w-80 px-4 pt-10 p-2 rounded-t-lg justify-between"
            style={{ background: Colors.backgroundBeige }}
          >
            <div className="rounded-scrollbar overflow-auto h-[70%]"></div>
          </div>
        </div>

        {/* Main content */}
        <div
          key={myData.id}
          className="flex-1 overflow-y-auto overflow-x-hidden"
        >
          {myData ? (
            <div className="flex flex-col min-h-full">
              <div className="bg-transparent z-10">
                <div className="overflow-x-auto">
                  <ResidueTable
                    data={chainsState}
                    selectedChain={selectedChain}
                  />
                </div>
              </div>
              <div className="bg-transparent z-10">
                <RangeSelecting
                  chains={chainsState}
                  selectedChain={selectedChain}
                  minId={minId}
                  maxId={maxId}
                  inputValueStart={inputValueStart}
                  inputValueEnd={inputValueEnd}
                  setChainsState={setChainsState}
                  setMinId={setMinId}
                  setMaxId={setMaxId}
                  setInputValueStart={setInputValueStart}
                  setInputValueEnd={setInputValueEnd}
                  handleChange={handleChange}
                  handleInputChangeStart={handleInputChangeStart}
                  handleInputChangeEnd={handleInputChangeEnd}
                />
              </div>
              {/* Forna + Molstar */}
              <div className="flex flex-row h-[60vh] min-h-[400px]">
                <div className="w-1/2 h-full p-5">
                  <FornaComponent
                    chains={chainsState}
                    setChains={setChainsState}
                    labelInterval={labelInterval}
                    numbering={numbering}
                    nodeOutline={nodeOutline}
                    nodeLabel={nodeLabel}
                    links={links}
                    directionArrows={directionArrows}
                    setAnimation={animation}
                    selectedChain={selectedChain}
                    setIsViewInitialized={setIsViewInitialized}
                  />
                </div>
                <div className="w-1/2 h-full p-5">
                  <Molstar
                    useInterface={true}
                    file={myData.pdb_file_string}
                    chains={chainsState}
                    setChains={setChainsState}
                    initialized={initialized}
                    setInitialized={setInitialized}
                    setIsViewInitialized={setIsViewInitialized}
                  />
                </div>
              </div>
            </div>
          ) : (
            <Loading />
          )}
        </div>
      </div>
      <SmallScreenPage />
    </div>
  );
};
export default Panel;
