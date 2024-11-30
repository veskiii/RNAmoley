import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Loading from "./loading";
import "../App.css";
import Molstar from "./mol";
import FornacComponent from "./fornaComponent";
import { Job } from "./Panel";
import DownloadLink from "./downloadLink";
import ErrorPage, { ErrorPageProps } from "./ErrorPage";
import JobProcessing from "./JobProcessing";

async function fetchMyData(jobID: string | undefined) {
  console.log(`Sending request to /api/v1/jobs/${jobID}`)
  const response = await fetch(`http://localhost:3000/api/v1/jobs/${jobID}`, {
    signal: AbortSignal.timeout(5000)
  });
  console.log("Fetch data response: "+response.status)
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
      console.log("Start to fetch data")
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
          console.log("data:", data);
        }
        
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setMyError({
          errorMessage: "Failed to fetch data",
          statusCode: "500",
        });
      } finally {
        console.error("Failed to fetch data:");

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

  return (
    <div className="flex h-screen w-screen flex-row overflow-hidden">
      <div className="w-[700px] bg-neutral-200">
        <div className="h-[75%] w-[85%] bg-white align-center"></div>
        <div className="flex flex-wrap items-end justify-center h-auto ml-4 mt-10 p-2 ">
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
        </div>
        <div className="flex flex-col h-[20%] ml-4 mt-3">
          <DownloadLink />
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
                    className="text-2xl font-bold place-self-center my-1"
                  >
                    2D view Job ID: {jobId}
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
                  structure={myData.annotation[0].dotbracket}
                  sequence={myData.annotation[0].sequnece}
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
