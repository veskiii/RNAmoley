import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Loading from "./loading";
import "../App.css";
import Molstar from "./mol";
import FornacComponent from "./fornaComponent";
import { Annotation } from "./Panel";
import { Numeration } from "./Panel";
import { Chain } from "./Panel";
import { Nucleotide } from "./Panel";
import { Colors } from "./colors"
import DownloadLink from "./downloadLink";
import ErrorPage, { ErrorPageProps } from "./ErrorPage";
import JobProcessing from "./JobProcessing";

interface Job {
  id: number;
  originalfilename: string;
  name: string;
  createdat: string;
  updatedat: string;
  annotation: Annotation[];
  numeration: Numeration;
  results: {
    mode: string;
    data: Results[];
  };
}

interface Residue_result {
  residue_number: number;
  metrics: {
    pdbFileName: string;
    x_H_type: string;
    chains: string;
    residues: string;
    nucacids: string;
    resolution: string;
    rvalue: string;
    rfree: string;
    clashscore: string;
    clashscoreB40: string;
    minresol: string;
    maxresol: string;
    n_samples: string;
    pct_rank: string;
    pct_rank40: string;
    numbadbonds: string;
    numbonds: string;
    pct_badbonds: string;
    pct_resbadbonds: string;
    numbadangles: string;
    numangles: string;
    pct_badangles: string;
    pct_resbadangles: string;
    chiralSwaps: string;
    tetraOutliers: string;
    pseudochiralErrors: string;
    waterClashes: string;
    totalWaters: string;
    numPperpOutliers: string;
    numPperp: string;
    numSuiteOutliers: string;
    numSuites: string;
  };
}

interface Results {
  residue_number: number;
  metrics: {
    pdbFileName: string;
    x_H_type: string;
    chains: string;
    residues: string;
    nucacids: string;
    resolution: string;
    rvalue: string;
    rfree: string;
    clashscore: string;
    clashscoreB40: string;
    minresol: string;
    maxresol: string;
    n_samples: string;
    pct_rank: string;
    pct_rank40: string;
    numbadbonds: string;
    numbonds: string;
    pct_badbonds: string;
    pct_resbadbonds: string;
    numbadangles: string;
    numangles: string;
    pct_badangles: string;
    pct_resbadangles: string;
    chiralSwaps: string;
    tetraOutliers: string;
    pseudochiralErrors: string;
    waterClashes: string;
    totalWaters: string;
    numPperpOutliers: string;
    numPperp: string;
    numSuiteOutliers: string;
    numSuites: string;
  };
}

function transformJobToChains(job: Job): Chain[] {
  const chains: Chain[] = [];

  let startIndex = Math.min(
    ...Object.values(job.numeration).map((entry) => entry[0])
  );

  // Iterate over each annotation to create a Chain object
  job.annotation.forEach((annotation) => {
    console.log("START INDEX = ", startIndex);
    const chain: Chain = {
      name: annotation.name,
      sequence: annotation.sequnece,
      dotBracket: annotation.dotbracket,
      nucleotides: [],
    };

    // Iterate over the sequence and dotBracket to build Nucleotides
    console.log(
      annotation.name,
      annotation.sequnece,
      annotation.sequnece.length
    );
    for (let i = 0; i < annotation.sequnece.length; i++) {
      const numerationKey = Object.keys(job.numeration).find(
        (key) =>
          job.numeration[key][0] === startIndex + i &&
          job.numeration[key][1] === annotation.name.slice(-1)
      );
      // console.log(numerationKey, )
      if (numerationKey) {
        const nucleotide: Nucleotide = {
          index: parseInt(numerationKey),
          original_index: job.numeration[numerationKey][0],
          base: annotation.sequnece[i],
          structure: annotation.dotbracket[i],
          selected: false,
        };
        chain.nucleotides.push(nucleotide);
      }
    }
    startIndex += annotation.sequnece.length;

    chains.push(chain);
    console.log(
      "CHAIN Z PANELU:",
      chain.name,
      chain.sequence,
      chain.nucleotides
    );
  });

  return chains;
}

async function fetchMyData(jobID: string | undefined) {
  console.log(`Sending request to /api/v1/jobs/${jobID}`);
  {
    /*const response = await fetch(`http://localhost:3000/api/v1/jobs/${jobID}`, {*/
  }
  const response = await fetch(
    `http://localhost:3069/jobs/b5b99b6e-24d1-480e-b9e8-7d3a7728a6cc`,
    {
      signal: AbortSignal.timeout(5000),
    }
  );
  console.log("Fetch data response: " + response.status);
  return response;
}

const Summary: React.FC = () => {
  const { jobId } = useParams();
  const [myData, setMyData] = useState<Job>();
  const [myError, setMyError] = useState<ErrorPageProps | null>(null);
  const [labelInterval, setLabelInterval] = useState(10);
  const [numbering, setNumbering] = useState(true);
  const [nodeOutline, setNodeOutline] = useState(true);
  const [nodeLabel, setNodeLabel] = useState(true);
  const [links, setLinks] = useState(true);
  const [directionArrows, setDirectionArrows] = useState(true);
  const [is2Dview, setIs2Dview] = useState(true);
  const [selectedNts, setSelectedNts] = useState<number[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [chainsState, setChainsState] = useState<Chain[]>([]);

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

  useEffect(() => {
    async function fetchData() {
      console.log("Start to fetch data");
      try {
        const response = await fetchMyData(jobId);
        const data = await response.json();
        if (!response.ok) {
          console.log(
            `Error during fetching data. Message: ${data.error} Status code: ${response.status}`
          );
          setMyError({
            errorMessage: data.error,
            statusCode: response.status.toString(),
          });
        } else {
          setMyData(data);
          const chains = transformJobToChains(data);
          setChainsState(chains);
          console.log("data:", data);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setMyError({
          errorMessage: "Failed to fetch data",
          statusCode: "500",
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [jobId]);

  if (isLoading) {
    return <JobProcessing />;
  }

  if (myError) {
    var message = myError.errorMessage;
    var code = myError.statusCode;
    return <ErrorPage errorMessage={message} statusCode={code} />;
  }

  if (!myData) {
    return <ErrorPage />;
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

  const rows: JSX.Element[] = [];
  myData.results.data.forEach((residue) => {
    rows.push(
      <tr
        key={residue.residue_number}
        className={residue.residue_number % 2 === 0 ? "bg-white" : "bg-gray-100"}
      >
        <td className="border border-neutral-300">{residue.residue_number}</td>
        <td className="border border-neutral-300">
          {residue.metrics.clashscore}
        </td>
        <td className="border border-neutral-300">
          {residue.metrics.pct_badangles}
        </td>
        <td className="border border-neutral-300">
          {residue.metrics.pct_badbonds}
        </td>
      </tr>
    );
  });
  // Użycie forEach do iterowania po danych

  return (
    <div className="flex flex-row h-screen w-screen overflow-y-auto">
      <div className="flex flex-col h-full">
        <div className="flex flex-row text-3xl font-medium items-center self-start p-[30px]">
          <div className="flex flex-col">
            <div className="font-extrabold">
              <h1>RNA</h1>
            </div>
            <div className="font-semibold pr-5 text-{#526969}">
              <h1 style={{ color: Colors.blue }}>MOLEY</h1>
            </div>
          </div>
          <h1>| Analysis Panel</h1>
        </div>
        <div style = {{backgroundColor: Colors.backgroundBlue}} className="w-[500px] h-full rounded-lg table-fixed">
          <div className="h-[75%] w-[85%] bg-white mx-auto mt-3">
            <table className="w-[100%] border-collapse border border-neutral-200 bg-white text-center">
              <thead>
                <tr>
                  <th className="border border-neutral-300">Residue Number</th>
                  <th className="border border-neutral-300">Clashscore</th>
                  <th className="border border-neutral-300">Bad angles</th>
                  <th className="border border-neutral-300">Bad bonds</th>
                </tr>
              </thead>
              <tbody>{rows}</tbody>
              {/*<tbody>
          {myData.data.results.data.map((residue) => (
            <tr key={residue.residue_number}>
              <td>{residue.residue_number}</td>
              <td>{residue.metrics.clashscore}</td>
              <td>{residue.metrics.clashscoreB40}</td>
            </tr>
          ))}
        </tbody>*/}
            </table>
          </div>
          {/*<div className="flex flex-wrap items-end justify-center h-auto ml-4 mt-10 p-2 ">
            <label className="w-1/4">
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
            <label className="w-1/4">
              <input
                type="checkbox"
                id="displNumbering"
                // defaultChecked
                checked={numbering}
                onChange={handleNumberingChange}
              />{" "}
              Numbering
            </label>
            <label className="w-1/4">
              <input
                type="checkbox"
                id="displNodeOutline"
                // defaultChecked
                checked={nodeOutline}
                onChange={handleNodeOutlineChange}
              />{" "}
              Node Outline
            </label>
            <label className="w-1/4">
              <input
                type="checkbox"
                id="displNodeLabel"
                // defaultChecked
                checked={nodeLabel}
                onChange={handleNodeLabelChange}
              />{" "}
              Node Label
            </label>
            <label className="w-1/4">
              <input
                type="checkbox"
                id="displLinks"
                // defaultChecked
                checked={links}
                onChange={handleLinksChange}
              />{" "}
              Links
            </label>
            <label className="w-1/4">
              <input
                type="checkbox"
                id="displDirectionArrows"
                // defaultChecked
                checked={directionArrows}
                onChange={handleDirectionArrowsChange}
              />{" "}
              Direction Arrows
            </label>
          </div>*/}
          <div className="flex flex-col h-[20%] ml-11 mt-6">
            <DownloadLink />
          </div>
        </div>
      </div>
      <div key={myData.id} className="flex-grow relative overflow-hidden">
        <div className="h-full">
          {myData ? (
            <div id="container">
              <div className="absolute top-0 h-[10%] flex-grow w-full bg-transparent z-100">
                <div className="grid relative">
                  <label
                    id="viewLabel"
                    className="text-2xl font-bold place-self-center my-1 pt-[30px]"
                  >
                    2D view
                  </label>
                  <button
                    id="switchViewButton"
                    onClick={toggle}
                    className="font-bold absolute right-[30px] top-[30px] rounded-lg p-4 text-2xl text-black flex justify-center items-center h-10 my-1 transition-colors bg-rose-400/80 hover:bg-sky-400"
                  >
                    3D view
                  </button>
                </div>
              </div>

              {is2Dview && (
                <FornacComponent
                  structures={myData.annotation.map((a) => a.dotbracket)}
                  sequences={myData.annotation.map((a) => a.sequnece)}
                  chains={chainsState}
                  labelInterval={labelInterval}
                  numbering={numbering}
                  nodeOutline={nodeOutline}
                  nodeLabel={nodeLabel}
                  links={links}
                  directionArrows={directionArrows}
                  setAnimation={false}
                  selectedNts={selectedNts}
                  setSelectedNts={setSelectedNts}
                />
              )}
              {!is2Dview && (
                <Molstar
                  useInterface={true}
                  pdbId={"7kuc"}
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
        </div>
      </div>
    </div>
  );
};

export default Summary;
