import React, { useEffect, useState } from "react";
import Loading from "../common/loading";
import "../../App.css";
import Molstar from "../visualizations/molStarComponent";
import FornaComponent from "../visualizations/fornacWrapper";
import { useNavigate, useParams } from "react-router-dom";
import FornaControls from "../common/fornaControls";
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import { SelectChangeEvent } from '@mui/material/Select';
import { Job, Chain, JobToPost } from "../utils/types";
import { fetchJobData } from "../utils/api";
import { transformJobToChains } from "../utils/transformJobToChains";
import { Colors } from "../common/colors"
import HelpIcon from "../common/helpIcon";
import Logo from "../common/logo";
import ErrorPage from "../common/ErrorPage";
import RangeSelecting from "../common/rangeSelecting";

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
  const [analyzeWholeStructure, setAnalyzeWholeStructure] = useState(true);
  const [selectedChain, setSelectedChain] = useState<string>(chainsState[0]?.name.slice(-1) || "");
  const [inputValueStart, setInputValueStart] = useState<string>('');
  const [inputValueEnd, setInputValueEnd] = useState<string>('');
  const [minId, setMinId] = useState<string>('');
  const [maxId, setMaxId] = useState<string>('');
  const [selectedList, setSelectedList] = useState<number[]>([]);
  const [isViewInitialized, setIsViewInitialized] = useState<boolean>(true)
  const { jobId } = useParams();
  const jobID = jobId;
  const navigate = useNavigate();

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
    setAnalyzeWholeStructure(e.target.checked);
  };

  const handleSubmit = () => {
    const start = parseInt(inputValueStart, 10);
    const end = parseInt(inputValueEnd, 10);

    if (isNaN(start) || isNaN(end) || start > end || start <= 0 || end <= 0) {
      alert(`Invalid range: ${start} to ${end}`);
      return;
    }
    if (minId && maxId && start >= parseInt(minId, 10) && end <= parseInt(maxId, 10)) {
      setChainsState(prevChains =>
        prevChains.map(chain => {
          if (chain.name.slice(-1) === selectedChain) {

            return {
              ...chain,
              nucleotides: chain.nucleotides.map(nucleotide => ({
                ...nucleotide,
                selected: nucleotide.index >= start && nucleotide.index <= end,
              })),
            };
          }
          return chain;
        }));
    } else {
      alert("Type valid range on selected chain");
    }

  };

  //do placeholder z max i min original_id nukleotydów podanego chain
  useEffect(() => {
    chainsState.forEach((chain) => {
      if (chain.name.slice(-1) === selectedChain) {
        const indices = chain.nucleotides.map(nucleotide => nucleotide.index);
        const min = Math.min(...indices);
        const max = Math.max(...indices);

        setMinId(min.toString());
        setMaxId(max.toString());
        setInputValueStart(min.toString());
        setInputValueEnd(max.toString());
      }

    })
  }, [selectedChain])

  // useEffect(() => {
  //   chainsState.forEach(chain => {
  //     console.log("Chain z panelu:", chain)
  //   })
  // }, [chainsState]);

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

  async function sendDataToAnalyze() {
    var API_URL = '';

    if (!jobID) {
      throw new Error("jobID is required");
    }

    var jobToPost: JobToPost = { id: '', residues: [], modelNumber: 0, radius: 0, interval: 0 };
    if (analyzeWholeStructure) {
      API_URL = "http://rnamoley.cs.put.poznan.pl/api/v1/jobs/analyzeStructure";
      const radius = parseInt((document.getElementById("radiusInput") as HTMLInputElement).value);
      const interval = parseInt((document.getElementById("intervalInput") as HTMLInputElement).value);
      jobToPost = { id: jobID, modelNumber: selectedModel, residues: [], radius: radius, interval: interval }
    } else {
      API_URL = "http://rnamoley.cs.put.poznan.pl/api/v1/jobs/analyzeFragment";
      idList = chainsState.flatMap((chain) =>
        chain.nucleotides
          .filter((nucleotide) => nucleotide.selected)
          .map((nucleotide) => nucleotide.index)
      );
      jobToPost = { id: jobID, modelNumber: 0, residues: idList, radius: 0, interval: 0 }
    }

    try {
      const response = await fetch(`${API_URL}`, {
        method: "POST",
        body: JSON.stringify(jobToPost),
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const data = await response.json();
        console.log("Data posted successfully:", data.id);
      } else {
        let errorData = await response.json();
        console.error("Error creating job:", errorData);
        const errorMessage = errorData?.message || "Unknown error";
        alert("Failed to create job: " + errorMessage);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to create job");
    }
  }

  function handleNavigate() {
    sendDataToAnalyze();
    navigate(`/summary/${jobID}`);
  }

  const handleSetSelectedModel = (e: SelectChangeEvent) => {
    setSelectedModel(parseInt(e.target.value));
  }

  const changeModel = (model: number) => {
    if (!jobID || model === selectedModel) return;
    loadData(jobID, model);
  }

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
  }, [chainsState])

  if (error) return <ErrorPage errorMessage={error} />;
  if (!myData) {
    return <Loading page="Analysis panel" />;
  }
  return (
    <div className="flex h-screen w-screen flex-row overflow-hidden">
      <div className="w-80 bg-neutral-200" style={{ background: Colors.backgroundBeige }}>
        <div className="flex pl-4 pt-4 h-[15%]">
          <Logo page="Analysis panel" />
          <HelpIcon />
        </div>

        <div className="flex flex-col h-[65%] mx-4 mt-10 p-2">
          <div className="rounded-scrollbar overflow-auto">
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

            <Accordion>
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
                          Model{''}
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
                        >Change model</button>
                      </div>

                      {analyzeWholeStructure && (
                        <div>
                          <div >
                            <label className="options">
                              Radius{''}
                              <input id="radiusInput"
                                className="mx-4 my-2 w-[50%] border-gray-300 border-2 pl-2 justify-center p-1 rounded-lg"
                                type="number"
                                defaultValue={5}
                              />
                            </label>
                          </div>

                          <div>
                            <label className="options">
                              Interval{''}
                              <input id="intervalInput"
                                className="ml-3 w-[50%] border-gray-300 border-2 pl-2 justify-center p-1 rounded-lg"
                                type="number"
                                defaultValue={1}
                              />
                            </label>
                          </div>
                        </div>
                      )
                      }

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
              </Accordion>)}
          </div>

        </div>
        <div className="flex flex-col h-[20%] ml-4 mt-3">
          <button
            type="submit"
            disabled={!(analyzeWholeStructure || selectedList.length > 0)}
            className={`font-bold rounded-lg p-2 z-10 text-black flex justify-center items-center h-auto w-[90%] my-1 ${!(analyzeWholeStructure || selectedList.length > 0) ? "bg-gray-400 cursor-not-allowed" : ""
              } transition-colors text-2xl text-black`}
            onClick={handleNavigate}
          >
            Analyze
          </button>
        </div>
      </div>
      <div key={myData.id} className="flex-grow relative overflow-hidden">
        <div className="h-full">
          {myData ? (
            <div id="container">
              <div className="absolute top-0 h-[15%] flex-grow w-full bg-transparent z-100">
                <div className="grid relative mt-1.5 px-1.5">
                  <label
                    id="viewLabel"
                    className="text-2xl font-medium place-self-center my-1"
                  >
                    {is3Dview ? "3D view" : "2D view"}
                  </label>
                  <button
                    id="switchViewButton"
                    onClick={() => {setIs3Dview(!is3Dview); setIsViewInitialized(false);}}
                    disabled={!isViewInitialized}
                    className="font-medium absolute right-2 rounded-lg p-4 text-2xl text-black flex justify-center items-center h-10 my-1"
                  >
                    Switch view
                  </button>
                </div>
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
                { is3Dview && (
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
  );
};
export default Panel;
