import React, { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import Loading from "./loading";
import DownloadLink from "./downloadLink";
import ThreeDView from "./ThreeDView";
import clsx from "clsx";
import TwoDView from "./TwoDView";
import "../App.css";
import { NameContext } from "../App";
import Molstar from "./mol";
import FornacComponent from "./fornaComponent";
import { useLocation } from "react-router-dom";

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

interface Annotation{
  name: string;
  sequnece: string;
  dotbracket: string;
}

interface Numeration {
  [key: string] : [number, string];
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

function transformJobToChains(job: Job): Chain[] {
  const chains: Chain[] = [];

  let id = 1;
  job.annotation.forEach((annotation) => {

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
              console.log("Dodano nukleotyd: ",nucleotide);
          }
          console.log("id:", id);
          console.log("Dlugość sekwencji: ",annotation.sequnece.length);
          id++;

      }

      chains.push(chain);
      console.log("Dodano łańcuch:", chain.name, chain.sequence,chain.dotBracket, chain.nucleotides);
  });

  return chains;
}


async function fetchMyData(jobID: string | undefined): Promise<Job> {
  //http://localhost:4200/jobs
  const response = await fetch(`http://localhost:3000/api/v1/jobs/${jobID}`);
  const data = await response.json();
  return data;
}
const Panel: React.FC = () => {
  const { jobId } = useParams();
  const [myData, setMyData] = useState<Job>();
  const [error, setError] = useState<string | null>(null);
  const [labelInterval, setLabelInterval] = useState(10);
  const [numbering, setNumbering] = useState(true);
  const [nodeOutline, setNodeOutline] = useState(true);
  const [nodeLabel, setNodeLabel] = useState(true);
  const [links, setLinks] = useState(true);
  const [directionArrows, setDirectionArrows] = useState(true);
  const [animation, setAnimation] = useState(true);
  const [is2Dview, setIs2Dview] = useState(true);
  const [selectedNts, setSelectedNts] = useState<number[]>([]);
  const [initialized, setInitialized] = useState(false);
  const width = document.getElementById("container")?.clientWidth || 1300;
  const height = document.getElementById("container")?.clientHeight || 700;
  let color = "black";
  
  const [chainsState, setChainsState] = useState<Chain[]>([]);

  const location = useLocation();
  const rnaFile = location.state?.rnaFile;
  var pdbCode = location.state?.pdbCode;
  const pdbCodeRadioButton = location.state?.radiobutton;

  const pdbString = "";

  if(!pdbCode){
    pdbCode = pdbCodeRadioButton;
  }

  const context = useContext(NameContext);
  if (context) {
    const { jobID } = context;
    console.log("Got jobID:", jobID);
  }

  function toggle() {
    setIs2Dview((is2Dview) => {
      is2Dview = !is2Dview;
      console.log(is2Dview);
      let switchViewButton = document.getElementById(
        "switchViewButton"
      ) as HTMLElement;
      let viewLabel = document.getElementById("viewLabel") as HTMLElement;
      let bottom_seq = document.getElementById("bottom-seq") as HTMLElement;
      if (is2Dview) {
        switchViewButton.textContent = "3D view";
        viewLabel.textContent = "2D view";
        bottom_seq.style.setProperty("display", "block", "important");
      } else {
        switchViewButton.textContent = "2D view";
        viewLabel.textContent = "3D view";

        bottom_seq.style.setProperty("display", "none", "important");
      }
      return is2Dview;
    });
  }

  const handleLabelIntervalChange = (e: any) => {
    setLabelInterval(parseInt(e.target.value, 10));
  };

  const handleNumberingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNumbering(e.target.checked);
  };

  const handleNodeOutlineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNodeOutline(e.target.checked);
  };

  const handleNodeLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNodeLabel(e.target.checked);
  };

  const handleLinksChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLinks(e.target.checked);
  };

  const handleDirectionArrowsChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setDirectionArrows(e.target.checked);
  };

  const handleAnimationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAnimation(e.target.checked);
  };

  const setColor = (index: number) => {
    if (selectedNts.includes(index)) {
      setSelectedNts((prevSelected) => {
        if (prevSelected.includes(index)) {
          return prevSelected.filter((id) => id !== index);
        }

        return prevSelected;
      });
    } else {
      {
        setSelectedNts((prevSelected) => {
          if (!prevSelected.includes(index)) return [...prevSelected, index];
          return prevSelected;
        });
      }
    }
  };

  const jobID = context?.jobID;
  useEffect(() => {
    if (!jobID) return;
    async function fetchData() {
      try {
        // throw Error("Testing throw error");
        const data = await fetchMyData(jobID);
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
    fetchData();
  }, [jobID]);

  if (!myData) {
    return <Loading />;
  }

  return (
    <div className="flex h-screen w-screen flex-row overflow-hidden">
      <div className="w-80 bg-neutral-200">
        {/* TODO: accordion */}
        {/* <div className="rounded-scrollbar"><AccordionUsage /></div> */}
        <div className="flex flex-col h-[80%] ml-4 mt-10 p-2 ">
          <label className="">
            Label interval:
            <br />
            <input
              type="number"
              value={labelInterval}
              onChange={handleLabelIntervalChange}
              placeholder="Label Interval"
              className="rounded-lg w-24 mb-2"
            />
          </label>
          <label className="options">
            <input
              type="checkbox"
              id="displNumbering"
              // defaultChecked
              checked={numbering}
              onChange={handleNumberingChange}
            />{" "}
            Numbering
          </label>
          <label className="options">
            <input
              type="checkbox"
              id="displNodeOutline"
              // defaultChecked
              checked={nodeOutline}
              onChange={handleNodeOutlineChange}
            />{" "}
            Node Outline
          </label>
          <label className="options">
            <input
              type="checkbox"
              id="displNodeLabel"
              // defaultChecked
              checked={nodeLabel}
              onChange={handleNodeLabelChange}
            />{" "}
            Node Label
          </label>
          <label className="options">
            <input
              type="checkbox"
              id="displLinks"
              // defaultChecked
              checked={links}
              onChange={handleLinksChange}
            />{" "}
            Links
          </label>
          <label className="options">
            <input
              type="checkbox"
              id="displDirectionArrows"
              // defaultChecked
              checked={directionArrows}
              onChange={handleDirectionArrowsChange}
            />{" "}
            Direction Arrows
          </label>
          <label className="options">
            <input
              type="checkbox"
              id="animation"
              // defaultChecked
              checked={animation}
              onChange={handleAnimationChange}
            />{" "}
            Enable Animation
          </label>
          <p className="mt-5 mb-5">
            [left click] select nodes
            <br />
            [left click + drag] drag/rotate object
            <br />
            [ctrl + left click + drag] box selecting
            <br />
            {/* [c] center the graph */}
          </p>
        </div>
        <div className="flex flex-col h-[20%] ml-4 mt-3">
          <DownloadLink />
        </div>
      </div>
      {/* 
      <div className="absolute top-0 h-[10%] flex-grow w-full p-2 rounded-t-lg bg-slate-300 ">
        <div className="grid relative">
          <label
            id="viewLabel"
            className="text-2xl font-bold place-self-center my-1"
          >
            2D view
          </label>
          <button
            id="switchViewButton"
            onClick={toggle}
            className="font-bold absolute right-0 rounded-lg p-4 text-2xl text-black flex justify-center items-center h-10 my-1 transition-colors bg-rose-300/80 hover:bg-teal-600"
          >
            3D view
          </button>
        </div>
      </div> */}

      <div key={myData.id} className="flex-grow relative overflow-hidden">
        <div className="h-full">
          {/* <div
            className={` text-xl items-center text-justify font-semibold overflow-x-scroll pb-2 break-words drop-shadow-xl`}
          > */}
          {/* {myData.dotbracket} */}
          {/* </div> */}

          {/* <h1>{data.id}</h1>
              <h2>{data.sequnece}</h2>
              <p>{data.dotbracket}</p>
              <p>{data.originalfilename}</p> */}
          {myData ? (
            <div id="container">
              <div className="absolute top-0 h-[10%] flex-grow w-full bg-transparent z-100">
                <div className="grid relative">
                  <label
                    id="viewLabel"
                    className="text-2xl font-bold place-self-center my-1"
                  >
                    2D view
                  </label>
                  <button
                    id="switchViewButton"
                    onClick={toggle}
                    className="font-bold absolute right-2 rounded-lg p-4 text-2xl text-black flex justify-center items-center h-10 my-1 transition-colors bg-rose-400/80 hover:bg-sky-400"
                  >
                    3D view
                  </button>
                </div>
              </div>

              {is2Dview && (
                <FornacComponent
                  structures={myData.annotation.map((a) => a.dotbracket)}
                  sequences={myData.annotation.map((a) => a.sequnece)}
                  chains = {chainsState}
                  labelInterval={labelInterval}
                  numbering={numbering}
                  nodeOutline={nodeOutline}
                  nodeLabel={nodeLabel}
                  links={links}
                  directionArrows={directionArrows}
                  setAnimation={animation}
                  selectedNts={selectedNts}
                  setSelectedNts={setSelectedNts}
                />

                // <TwoDView
                //   sequence={myData.sequnece}
                //   structure={myData.dotbracket}
                //   SELECTED={selectedNts}
                //   setSELECTED={setSelectedNts}
                //   nodeLabel={nodeLabel}
                //   directionArrows={directionArrows}
                //   numbering={numbering}
                //   labelInterval={labelInterval}
                //   width={width}
                //   height={height}
                // />

                // <RNAVisualizer />
              )}
              {!is2Dview && (
                // <ThreeDView
                //   sequence={myData.sequnece}
                //   SELECTED={selectedNts}
                //   setSELECTED={setSelectedNts}
                //   atoms={myData.data.atoms}
                // />
                <Molstar
                  useInterface={true}
                  // pdbId={pdbCode}
                  file={myData.pdb_file_string}
                  chains = {chainsState}
                  setChains = {setChainsState}
                  selectedNts={selectedNts}
                  setSelectedNts={setSelectedNts}
                  initialized={initialized}
                  setInitialized={setInitialized}
                />
              )}
            </div>
          ) : (
            <Loading />
          )}

          {/* <Molstar
            useInterface={true}
            pdbId="1cbs"
            dimensions={["100%", "500px"]}
            showControls={true}
            showAxes={false}
          /> */}

          <div
            id="bottom-seq"
            className="absolute left-0 right-0 overflow-x-scroll overflow-y-hidden bottom-0 text-xl items-center text-justify font-semibold break-words drop-shadow-xl"
          >
            {/* <div className="whitespace-nowrap w-max cursor-pointer ml-2">
              {myData.sequnece.split("").map((nt, index) => (
                <span
                  className={clsx(
                    selectedNts.includes(index) ? "text-red-500" : ""
                  )}
                  key={index}
                  onClick={() => setColor(index)}
                >
                  {nt}
                </span>
              ))}
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
};
export default Panel;
