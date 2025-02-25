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
    <div>
      <div className="desktop-content flex h-screen w-screen flex-row overflow-hidden">
        <div className="w-80">
          <div className="w-[700px] bg-white items-start">
            <div className="h-[70px] flex flex-row gap-8 pl-4">
              <Logo page="Analysis panel" />
              <div className="flex flex-row gap-8">
                <HomeIcon />
                <HelpIcon />
              </div>
            </div>
          </div>
          <div
            className="flex flex-col h-full w-80 px-4 pt-10 p-2 rounded-t-lg justify-between"
            style={{ background: Colors.backgroundBeige }}
          >
            <div className="rounded-scrollbar overflow-auto h-[70%]">
              <Accordion defaultExpanded>
                <AccordionSummary
                  aria-controls="panel2-content"
                  id="panel2-header"
                >
                  <Typography>Analyze structure</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography component="div">
                    <div>
                      <label className="options">
                        <input
                          type="checkbox"
                          id="analyze_whole_structure"
                          checked={analyzeWholeStructure}
                          onChange={handleAnalyzeChange}
                        />{" "}
                        Analyze whole structure
                      </label>
                      <div>
                        <div>
                          <label className="options">
                            Model{""}
                            <input
                              className="mx-5 my-2 w-[50%] border-gray-300 border-2 pl-2 justify-center p-1 rounded-lg"
                              type="number"
                              min="1"
                              max={myData.metadata.model_count}
                              value={selectedModel}
                              onChange={handleSetSelectedModel}
                            />
                          </label>

                          <button
                            className=" right-2 rounded-lg p-4 text-lg font-semibold text-black flex justify-center items-center h-10 my-1"
                            onClick={() => changeModel(selectedModel)}
                          >
                            Change model
                          </button>
                        </div>

                        {analyzeWholeStructure && (
                          <div>
                            <div>
                              <label className="options">
                                Radius{""}
                                <input
                                  id="radiusInput"
                                  className="mx-4 my-2 w-[50%] border-gray-300 border-2 pl-2 justify-center p-1 rounded-lg"
                                  type="number"
                                  defaultValue={5}
                                  min="1"
                                />
                              </label>
                            </div>

                            <div>
                              <label className="options">
                                Interval{""}
                                <input
                                  id="intervalInput"
                                  className="ml-3 w-[50%] border-gray-300 border-2 pl-2 justify-center p-1 rounded-lg"
                                  type="number"
                                  defaultValue={1}
                                  min="1"
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Typography>
                </AccordionDetails>
              </Accordion>
              {!is3Dview && (
                <Accordion>
                  <AccordionSummary
                    aria-controls="panel1-content"
                    id="panel1-header"
                  >
                    <Typography>Fornac options</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography component="div">
                      <div>
                        <FornaControls
                          labelInterval={labelInterval}
                          setLabelInterval={setLabelInterval}
                          numbering={numbering}
                          setNumbering={setNumbering}
                          nodeOutline={nodeOutline}
                          setNodeOutline={setNodeOutline}
                          nodeLabel={nodeLabel}
                          setNodeLabel={setNodeLabel}
                          links={links}
                          setLinks={setLinks}
                          directionArrows={directionArrows}
                          setDirectionArrows={setDirectionArrows}
                          animation={animation}
                          setAnimation={setAnimation}
                        />
                      </div>
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              )}
              {!is3Dview && (
                <Accordion>
                  <AccordionSummary
                    aria-controls="panel1-content"
                    id="panel1-header"
                  >
                    <Typography>How to use fornac</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography component="div">
                      <div className="mt-5 mb-5">
                        [left click] select single node
                        <br />
                        [ctrl + left click] select/deselect multiple nodes
                        <br />
                        [left click + drag] drag object
                        <br />
                        [ctrl + left click + drag] box selecting
                        <br />
                        [c] center the graph
                      </div>
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              )}
            </div>
            <div
              className="relative flex flex-col h-[20%] ml-4 my-4"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {isDisabled && isHovered && (
                <div
                  id="analyzeButtonTooltip"
                  className="absolute bottom-full mb-2 mx-auto text-sm bg-white text-black rounded bg-opacity-70 shadow-xl p-2 z-40"
                  style={{ left: "45%", transform: "translateX(-50%)" }}
                >
                  Select fragment to analyze or check option 'Analyze whole
                  structure' to run analysis.
                </div>
              )}
              <button
                id="analyzeButton"
                type="submit"
                disabled={isDisabled}
                className={`font-bold rounded-lg p-2 z-10 text-black flex justify-center items-center h-auto w-[90%] my-1
          ${isDisabled ? "bg-gray-400 cursor-not-allowed" : ""}
          transition-colors text-2xl text-black`}
                onClick={handleNavigate}
              >
                Analyze
              </button>
            </div>
          </div>
        </div>
        <div key={myData.id} className="flex-grow relative overflow-hidden">
          <div className="h-full">
            {myData ? (
              <div id="container">
                <div className="flex pt-1.5 pr-1.5 h-[70px]">
                  <button
                    id="switchViewButton"
                    onClick={() => {
                      setIs3Dview(!is3Dview);
                      setIsViewInitialized(false);
                    }}
                    disabled={!isViewInitialized}
                    className="w-[auto] font-medium absolute right-2 rounded-lg text-2xl text-black flex justify-center items-center h-10 my-1 px-4"
                  >
                    Switch to {is3Dview ? "2D " : "3D "} view
                  </button>
                </div>
                <div className="top-0 h-[20%] flex-grow bg-transparent z-100">
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
                {is3Dview && (
                  <Molstar
                    useInterface={true}
                    file={myData.pdb_file_string}
                    chains={chainsState}
                    setChains={setChainsState}
                    initialized={initialized}
                    setInitialized={setInitialized}
                    setIsViewInitialized={setIsViewInitialized}
                  />
                )}
                {!is3Dview && (
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
                )}
              </div>
            ) : (
              <Loading />
            )}
          </div>
        </div>
      </div>
      <SmallScreenPage />
    </div>
  );
};
export default Panel;
