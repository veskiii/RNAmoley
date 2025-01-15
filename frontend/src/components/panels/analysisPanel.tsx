import React, { useEffect, useState, useContext } from "react";
import Loading from "../common/loading";
import "../../App.css";
import { NameContext } from "../../App";
import Molstar from "../visualizations/molStarComponent";
import FornaComponent from "../visualizations/fornaComponent";
import { useNavigate } from "react-router-dom";
import FornaControls from "../common/fornaControls";
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import AnalyzeButton from "../common/analyzeButton";
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
interface Atom {
  serial: number;
  name: string;
  altLoc: string;
  resName: string;
  chainID: string;
  resSeq: number;
  iCode: string;
  x: number;
  y: number;
  z: number;
  occupancy: number;
  tempFactor: number;
  element: string;
  charge: string;
}

export interface Annotation {
  name: string;
  sequnece: string;
  dotbracket: string;
}

export interface Numeration {
  [key: string]: [number, string];
}

interface Metadata {
  status: string;
  model_count: number;
}

interface Job {
  id: number;
  originalfilename: string;
  name: string;
  createdat: string;
  updatedat: string;
  annotation: Annotation[];
  numeration: Numeration;
  data: {
    atoms: Atom[];
  };
  pdb_file_string: string;
  metadata: Metadata;
  model_number: number;
}

export interface Nucleotide {
  index: number;
  original_index: number;
  base: string;
  structure: string;
  selected: boolean;
}

export interface Chain {
  name: string;
  nucleotides: Nucleotide[];
  sequence: string;
  dotBracket: string;
}

interface JobToPost {
  id: string;
  residues: number[];
  modelNumber: number;
  radius: number;
  interval: number;
}

export function transformJobToChains(job: Job): Chain[] {
  const chains: Chain[] = [];

  if (!job.annotation || job.annotation.length === 0) {
    throw new Error("Annotation is undefined or empty.");
  }

  if (!job.numeration || Object.keys(job.numeration).length === 0) {
    throw new Error("Numeration is undefined or empty.");
  }

  let id = 1;
  job.annotation.forEach((annotation) => {
    if ((annotation.sequnece.length !== annotation.dotbracket.length) || annotation.sequnece.length === 0 || annotation.dotbracket.length === 0) {
      throw new Error("Sequence length and dotBracket length are not equal or 0.");
    }

    const chain: Chain = {
      name: annotation.name,
      sequence: annotation.sequnece,
      dotBracket: annotation.dotbracket,
      nucleotides: []
    };

    for (let i = 0; i < annotation.sequnece.length; i++) {

      const numerationKey = Object.keys(job.numeration).find(key => parseInt(key, 10) === id && job.numeration[key][1] === annotation.name.slice(-1));
      if (numerationKey) {
        const nucleotide: Nucleotide = {
          index: parseInt(numerationKey, 10),
          original_index: job.numeration[numerationKey][0],
          base: annotation.sequnece[i],
          structure: annotation.dotbracket[i],
          selected: false,
        };
        chain.nucleotides.push(nucleotide);
        console.log("Dodano nukleotyd: ", nucleotide);
      }
      console.log("id:", id);
      console.log("Dlugość sekwencji: ", annotation.sequnece.length);
      id++;

    }
    if (chain.nucleotides.length !== chain.sequence.length) {
      throw new Error("Number of nucleotides do not match length of the sequence.");
    }
    chains.push(chain);
    console.log("Dodano łańcuch:", chain.name, chain.sequence, chain.dotBracket, chain.nucleotides);
  });

  return chains;
}

async function fetchJobData(jobID: string | undefined, model: number = 1): Promise<Job> {
  try {
    const response = await fetch(`http://localhost:3000/api/v1/jobs/${jobID}/${model}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  }
  catch (error) {
    console.error("Error in fetchMyData:", error);
    throw error;
  }

}
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
  const [selectedChain, setSelectedChain] = useState<string>(chainsState[0]?.name.slice(-1) || "");
  const [inputValueStart, setInputValueStart] = useState('');
  const [inputValueEnd, setInputValueEnd] = useState('');
  const [minId, setMinId] = useState<string>('');
  const [maxId, setMaxId] = useState<string>('');

  useEffect(()=>{
    setSelectedChain(chainsState[0]?.name.slice(-1));
  },[chainsState]);

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

  useEffect(() => {
    chainsState.forEach(chain => {
      console.log("Chain z panelu:", chain)
    })
  }, [chainsState]);

  async function loadData(jobID: string | undefined, model: number = 1) {
    try {
      const data = await fetchJobData(jobID, model);
      setMyData(data);
      const chains = transformJobToChains(data);
      setChainsState(chains);
      console.log("data:", data);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      }
      //TODO?: NotFound
    }
  }


  function toggle() {
    setIs3Dview((is3Dview) => {
      is3Dview = !is3Dview;
      console.log(is3Dview);
      let switchViewButton = document.getElementById(
        "switchViewButton"
      ) as HTMLElement;
      let viewLabel = document.getElementById("viewLabel") as HTMLElement;
      if (is3Dview) {
        viewLabel.textContent = "3D view";
      } else {
        viewLabel.textContent = "2D view";
      }
      return is3Dview;
    });
  }

  async function sendDataToAnalyze() {
    var idList: number[] = [];
    var API_URL = '';

    if (!jobID) {
      throw new Error("jobID is required");
    }

    var jobToPost: JobToPost = { id: '', residues: [], modelNumber: 0, radius: 0, interval: 0 };
    if (analyzeWholeStructure) {
      API_URL = "http://localhost:3000/api/v1/jobs/analyzeStructure";
      const radius = parseInt((document.getElementById("radiusInput") as HTMLInputElement).value);
      const interval = parseInt((document.getElementById("intervalInput") as HTMLInputElement).value);
      jobToPost = { id: jobID, modelNumber: selectedModel, residues: [], radius: radius, interval: interval }
    } else {
      API_URL = "http://localhost:3000/api/v1/jobs/analyzeFragment";
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
          "Access-Control-Allow-Origin": "http://localhost:3000",
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

  const navigate = useNavigate();
  const goToDashboard = () => {
    navigate("/");
  }

  const handleSetSelectedModel = (e: SelectChangeEvent) => {
    setSelectedModel(parseInt(e.target.value));
  }

  const context = useContext(NameContext);
  const jobID = context?.jobID;
  const changeModel = (model: number) => {
    if (!jobID) return;
    loadData(jobID, model);
  }

  useEffect(() => {
    if (!jobID) return;
    loadData(jobID, 1);
  }, [jobID]);

  if (error) return <div>Error: {error}</div>;
  if (!myData) {
    return <Loading />;
  }

  return (
    <div className="flex h-screen w-screen flex-row overflow-hidden">
      <div className="w-80 bg-neutral-200">
        <div className="flex flex-col h-[80%] mx-4 mt-10 p-2">
          <div className="flex flex-row text-xl font-medium items-center self-start mb-4 ">
            <div className="flex flex-col">
              <div className="font-bold">
                <h1>RNA</h1>
              </div>
              <div className="font-semibold text-teal-600 ">
                <h1>MOLEY</h1>
              </div>
            </div>
            {/* TODO Logo Krecik */}
            {/* <img
            src="/krecik.png"
            width={100}
            height={100}
            alt="Logo RNA Moley"
          /> */}
            <h1 className="pl-2">| Submition panel</h1>
          </div>
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
                          className=" right-2 rounded-lg p-4 text-lg font-semibold text-black flex justify-center items-center h-10 my-1 transition-colors bg-rose-300 hover:bg-teal-600"
                          onClick={() => changeModel(selectedModel)}
                        >Change model</button>
                      </div>

                      <div >
                        <label className="options">
                          Radius{''}
                          <input id="radiusInput"
                            className="mx-4 my-2 w-[50%] border-gray-300 border-2 pl-2 justify-center p-1 rounded-lg"
                            type="number"
                          />
                        </label>
                      </div>

                      <div>
                        <label className="options">
                          Interval{''}
                          <input id="intervalInput"
                            className="ml-3 w-[50%] border-gray-300 border-2 pl-2 justify-center p-1 rounded-lg"
                            type="number"
                          />
                        </label>
                      </div>
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
        <div className="flex flex-col h-[30%] ml-4 mt-3">
          <AnalyzeButton onClick={handleNavigate} />
        </div>
      </div>
      <div key={myData.id} className="flex-grow relative overflow-hidden">
        <div className="h-full">
          
          {myData ? (
            <div id="container">
              <div className="absolute top-0 h-[20%] flex-grow w-full bg-transparent z-100">
                <div className="grid relative mt-2.5 p-1.5">
                  <button
                    className="font-medium absolute w-auto left-2 rounded-lg p-4 text-2xl text-black flex justify-center items-center h-10 my-1 transition-colors bg-rose-300 hover:bg-teal-600"
                    onClick={goToDashboard}
                  >
                    New Analysis
                  </button>
                  <label
                    id="viewLabel"
                    className="text-2xl font-medium place-self-center my-1"
                  >
                    3D view
                  </label>
                  <button
                    id="switchViewButton"
                    onClick={toggle}
                    className="font-medium absolute right-2 rounded-lg p-4 text-2xl text-black flex justify-center items-center h-10 my-1 transition-colors bg-rose-300 hover:bg-teal-600"
                  >
                    Switch view
                  </button>
                </div>
                <div className="flex items-center mx-4 space-x-4 z-0 text-xl font-semibold ">
            <Box sx={{ width: "80px", maxWidth: 120 }}>
              <FormControl fullWidth>
                <InputLabel id="demo-simple-select-label" >Chain</InputLabel>
                <Select
                  labelId="demo-simple-select-label"
                  id="demo-simple-select"
                  value={selectedChain||chainsState[0].name.slice(-1)}
                  label="Chain"
                  onChange={handleChange}
                  className="p-0"
                >
                  {chainsState.map((chain) => (
                    <MenuItem key={chain.name} value={chain.name.slice(-1)}>{chain.name.slice(-1)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <div className="flex flex-row  items-baseline m-6 mt-0">
              <label htmlFor="range_start" className="text-xl font-medium mr-4">From</label>
              <input
                id="range_start"
                type="number"
                min={minId}
                max={maxId}
                defaultValue={minId}
                onChange={handleInputChangeStart}
                placeholder={minId}
                className="w-[100px] p-2  mr-4 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <label htmlFor="range_end" className="text-xl font-medium  mr-4">To</label>
              <input
                id="range_end"
                type="number"
                min={minId}
                max={maxId}
                defaultValue={maxId}
                onChange={handleInputChangeEnd}
                placeholder={maxId}
                className="w-[100px] p-2  mr-4 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <button
                id="select_button"
                onClick={handleSubmit}
              >
                Select
              </button>
            </div>
          </div>
              </div>
              {is3Dview && (
                <Molstar
                  useInterface={true}
                  file={myData.pdb_file_string}
                  chains={chainsState}
                  setChains={setChainsState}
                  initialized={initialized}
                  setInitialized={setInitialized}
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
