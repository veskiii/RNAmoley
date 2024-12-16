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
import { Colors } from "./colors";
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
  metadata: Metadata;
  numeration: Numeration;
  results: {
    mode: string;
    data: [number, Metrics][];
  };
  pdb_file_string: string;
}

interface Metadata {
  status: string;
}

interface Metrics {
  clashscore: string;
  numbadbonds: string;
  pct_badbonds: string;
  numbadangles: string;
  pct_badangles: string;
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
  const response = await fetch(`http://localhost:3000/api/v1/jobs/${jobID}`, {
    signal: AbortSignal.timeout(5000),
  });
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
  const [is3Dview, setIs3Dview] = useState(true);
  const [selectedNts, setSelectedNts] = useState<number[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [chainsState, setChainsState] = useState<Chain[]>([]);

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

  const numToColor: { [key: string]: string } = {
    n1: "red",
    n2: "blue",
    n3: "green",
    n4: "purple",
    // Add more mappings as needed
  };

  function colorGnodes() {
    const gNodes = document.getElementsByClassName("gnode");

    Array.from(gNodes).forEach((gNode) => {
      // Get the num attribute value
      const numValue = gNode.getAttribute("num");

      // Find the corresponding color for this num
      if (numValue) {
        // Ensure numValue is not null or undefined
        // Find the corresponding color for this num
        const color = numToColor[numValue];

        if (color) {
          // Find the circle element inside the gnode and cast it to HTMLCircleElement
          const circle = gNode.querySelector("circle.fornac-node");

          if (circle && circle instanceof SVGCircleElement) {
            // Ensure it's an SVGCircleElement
            // Update the fill color based on the num value
            circle.style.fill = color;
          }
        }
      }
    });
  }

  useEffect(() => {
    // Only run myFunction when FornacComponent is rendered (is3Dview is false)
    if (!is3Dview) {
      colorGnodes();
    }
  }, [is3Dview]);

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

  if (myData.metadata.status !== "completed") {
    return <JobProcessing />;
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

  function makeTable(myData: Job) {
    const rows: JSX.Element[] = [];
    const indices: string[] = [];
    const original_indices: number[] = [];

    myData.results.data.forEach((residue) => {
      indices.push(residue[0].toString());
    });

    indices.forEach((index) => {
      original_indices.push(myData.numeration[index]?.[0]);
    });

    if (myData.results.mode === "fragment") {
      return (
        <tbody className="w-full">
          <tr>
            <th className="border border-neutral-300 bg-gray-100 w-[70%] p-3 text-2xl font-semibold">
              Residue numbers range
            </th>
            <td className="border border-neutral-300 bg-gray-100 w-[30%] text-2xl">
              {original_indices[0]} -{" "}
              {original_indices[original_indices.length - 1]}
            </td>
          </tr>
          <tr>
            <th className="border border-neutral-300 p-3 text-2xl font-semibold">
              Clashscore
            </th>
            <td className="border border-neutral-300 text-2xl">
              {myData.results.data[0][1].clashscore}
            </td>
          </tr>
          <tr>
            <th className="border border-neutral-300 bg-gray-100 p-3 text-2xl font-semibold">
              Bad angles
            </th>
            <td className="border border-neutral-300 bg-gray-100 text-2xl">
              {myData.results.data[0][1].numbadangles}
            </td>
          </tr>
          <tr>
            <th className="border border-neutral-300 p-3 text-2xl font-semibold">
              Bad bonds
            </th>
            <td className="border border-neutral-300 text-2xl">
              {myData.results.data[0][1].numbadbonds}
            </td>
          </tr>
        </tbody>
      );
    } else if (myData.results.mode === "full") {
      myData.results.data.forEach((residue, i) => {
        rows.push(
          <tr
            key={residue[0]}
            className={residue[0] % 2 === 0 ? "bg-white" : "bg-gray-100"}
          >
            <td className="border border-neutral-300">{original_indices[i]}</td>
            <td className="border border-neutral-300">
              {residue[1].clashscore}
            </td>
            <td className="border border-neutral-300">
              {residue[1].pct_badangles}
            </td>
            <td className="border border-neutral-300">
              {residue[1].pct_badbonds}
            </td>
          </tr>
        );
      });
      return (
        <tbody>
          <tr>
            <th className="border border-neutral-300">Residue numbers</th>
            <th className="border border-neutral-300">Clashscore</th>
            <th className="border border-neutral-300">Bad angles</th>
            <th className="border border-neutral-300">Bad bonds</th>
          </tr>
          {rows}
        </tbody>
      );
    } else {
      return <ErrorPage />;
    }
  }

  

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
        <div
          style={{ backgroundColor: Colors.backgroundBlue }}
          className="w-[500px] h-full rounded-lg table-fixed"
        >
          <div className="max-h-[75%] min-h-[110px] w-[85%] mx-auto mt-9 overflow-auto">
            <table className="w-full border-collapse border border-neutral-200 bg-white text-center">
              {makeTable(myData)}
            </table>
          </div>
          <div className="flex flex-col h-[20%] ml-11 mt-6">
            <DownloadLink />
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
                    3D view
                  </label>
                  <button
                    id="switchViewButton"
                    onClick={toggle}
                    className="font-bold absolute right-[30px] top-[30px] rounded-lg p-4 text-2xl text-black flex justify-center items-center h-10 my-1 transition-colors bg-rose-400/80 hover:bg-sky-400"
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
