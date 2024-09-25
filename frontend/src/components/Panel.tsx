import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Loading from "./loading";
import FornacComponent from "./fornaComponent";
import DownloadLink from "./downloadLink";
import ThreeDView from "./ThreeDView";
import clsx from "clsx";
import TwoDView from "./TwoDView";

//  TODO : change for backend data
//Now testing on local json server

interface Job {
  id: number;
  originalfilename: string;
  name: string;
  createdat: Date;
  updatedat: Date;
  sequence: string;
  dotbracket: string;
}

async function fetchMyData(): Promise<Job> {
  const response = await fetch("http://localhost:4200/jobs");
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

  function toggle() {
    setIs2Dview((is2Dview) => {
      is2Dview = !is2Dview;
      console.log(is2Dview);
      let switchViewButton = document.getElementById(
        "switchViewButton"
      ) as HTMLElement;
      let viewLabel = document.getElementById("viewLabel") as HTMLElement;

      if (is2Dview) {
        switchViewButton.textContent = "3D view";
        viewLabel.textContent = "2D view";
      } else {
        switchViewButton.textContent = "2D view";
        viewLabel.textContent = "3D view";
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

  useEffect(() => {
    async function fetchData() {
      try {
        // throw Error("Testing throw error");
        const data = await fetchMyData();
        setMyData(data);
      } catch (error) {
        if (error instanceof Error) {
          setError(error.message);
        }
        //TODO?: NotFound
      }
    }
    fetchData();
  }, [jobId]);

  if (!myData) {
    return <Loading />;
  }

  return (
    <div className="flex  h-screen flex-col md:flex-row md:overflow-hidden">
      <div className="w-full flex-none md:w-80 bg-slate-300 m-5 rounded-lg">
        {/* TODO: accordion */}
        {/* <div className="rounded-scrollbar"><AccordionUsage /></div> */}
        <div className="flex flex-col h-[80%] ml-4 mt-10 pl-4 ">
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
              defaultChecked
              checked={numbering}
              onChange={handleNumberingChange}
            />{" "}
            Numbering
          </label>
          <label className="options">
            <input
              type="checkbox"
              id="displNodeOutline"
              defaultChecked
              checked={nodeOutline}
              onChange={handleNodeOutlineChange}
            />{" "}
            Node Outline
          </label>
          <label className="options">
            <input
              type="checkbox"
              id="displNodeLabel"
              defaultChecked
              checked={nodeLabel}
              onChange={handleNodeLabelChange}
            />{" "}
            Node Label
          </label>
          <label className="options">
            <input
              type="checkbox"
              id="displLinks"
              defaultChecked
              checked={links}
              onChange={handleLinksChange}
            />{" "}
            Links
          </label>
          <label className="options">
            <input
              type="checkbox"
              id="displDirectionArrows"
              defaultChecked
              checked={directionArrows}
              onChange={handleDirectionArrowsChange}
            />{" "}
            Direction Arrows
          </label>
          <label className="options">
            <input
              type="checkbox"
              id="animation"
              defaultChecked
              checked={animation}
              onChange={handleAnimationChange}
            />{" "}
            Enable Animation
          </label>
          <p className="mt-5 mb-5">
            [ctrl + left click] select multiple nodes (can drag only when
            animation is enabled)
            <br />
            [c] center the graph
          </p>
        </div>
        <div className="flex flex-col h-[20%] ml-4 mt-3">
          <DownloadLink />
        </div>
      </div>
      <div className="flex-grow relative my-5 mx-10 rounded-lg bg-slate-300">
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
        </div>

        <div key={myData.id}>
          <div className="absolute bottom-0 h-[90%] flex-grow w-full rounded-b-lg bg-slate-600">
            {/* <div
              className={` text-xl items-center text-justify font-semibold overflow-x-scroll pb-2 break-words drop-shadow-xl`}
            >
              {myData.dotbracket}
            </div> */}
            <div className="text-xl items-center text-justify font-semibold overflow-x-scroll pb-2 break-words drop-shadow-xl">
              {myData.sequence.split("").map((nt, index) => (
                <span
                  className={clsx(
                    selectedNts.includes(index + 1) ? "text-red-500" : ""
                  )}
                  key={index}
                >
                  {nt}
                </span>
              ))}
            </div>
            {/* <h1>{data.id}</h1>
              <h2>{data.sequence}</h2>
              <p>{data.dotbracket}</p>
              <p>{data.originalfilename}</p> */}
            {is2Dview && (
              // <FornacComponent
              //   structure={myData.dotbracket}
              //   sequence={myData.sequence}
              //   labelInterval={labelInterval}
              //   numbering={numbering}
              //   nodeOutline={nodeOutline}
              //   nodeLabel={nodeLabel}
              //   links={links}
              //   directionArrows={directionArrows}
              //   setAnimation={animation}
              //   selectedNts={selectedNts}
              //   setSelectedNts={setSelectedNts}
              // />
              <TwoDView
                sequence={myData.sequence}
                structure={myData.dotbracket}
                SELECTED={selectedNts}
                setSELECTED={setSelectedNts}
              />
            )}
            {!is2Dview && (
              <ThreeDView
                sequence={myData.sequence}
                SELECTED={selectedNts}
                setSELECTED={setSelectedNts}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default Panel;
