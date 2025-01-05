import React, { useEffect, useState, useContext } from "react";
import Loading from "../common/loading";
import DownloadLink from "../common/downloadLink";
import "../../App.css";
import { NameContext } from "../../App";
import Molstar from "../visualizations/molStarComponent";
import FornaComponent from "../visualizations/fornaComponent";
import { useNavigate } from "react-router-dom";
import { SelectChangeEvent } from "@mui/material";
import FornaControls from "../common/fornaControls";
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';

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

interface Annotation {
  name: string;
  sequnece: string;
  dotbracket: string;
}

interface Numeration {
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

interface Nucleotide {
  index: number;
  original_index: number;
  base: string;
  structure: string;
  selected: boolean;
}

interface Chain {
  name: string;
  nucleotides: Nucleotide[];
  sequence: string;
  dotBracket: string;
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
  const width = document.getElementById("container")?.clientWidth || 1300;
  const height = document.getElementById("container")?.clientHeight || 700;
  const [analyzeWholeStructure, setAnalyzeWholeStructure] = useState(false);

  const handleAnalyzeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAnalyzeWholeStructure(e.target.checked);
  };

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
        switchViewButton.textContent = "2D view";
        viewLabel.textContent = "3D view";
      } else {
        switchViewButton.textContent = "3D view";
        viewLabel.textContent = "2D view";
      }
      return is3Dview;
    });
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
      {!is3Dview &&
        (<div className="w-80 bg-neutral-200">
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
                            <input
                              className="mx-4 my-2 w-[50%] border-gray-300 border-2 pl-2 justify-center p-1 rounded-lg"
                              type="number"
                            />
                          </label>
                        </div>

                        <div>
                          <label className="options">
                            Interval{''}
                            <input
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
            </div>



          </div>
          <div className="flex flex-col h-[20%] ml-4 mt-3">
            <DownloadLink />
          </div>
        </div>)
      }


      <div key={myData.id} className="flex-grow relative overflow-hidden">
        <div className="h-full">

          {myData ? (
            <div id="container">
              <div className="absolute top-0 h-[10%] flex-grow w-full bg-transparent z-100">
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
                    2D view
                  </button>
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
