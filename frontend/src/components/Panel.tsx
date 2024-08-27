import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DownloadLink from "./downloadLink";
import Loading from "./loading";

//  TODO : change for backend data
//Now testing on local json server

interface Job {
  id: number;
  sequence: string;
  dot_bracket: string;
}

async function fetchMyData(): Promise<Job[]> {
  const response = await fetch("http://localhost:4200/jobs");
  const data = await response.json();
  return data;
}
const Panel: React.FC = () => {
  const { jobId } = useParams();
  const [myData, setMyData] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // throw Error("Testing throw error");
        const data = await fetchMyData();
        setMyData(data);
      } catch (error) {
        let errorMessage = "Failed to fetch data";
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
    <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
      <div className="w-full flex-none md:w-80 bg-slate-300 m-5 rounded-lg">
        {/* TODO: analysis Panel with accordion */}
        {/* <div className="rounded-scrollbar"><AccordionUsage /></div> */}

        <div className="flex flex-col h-[20%] ml-4 mt-3">
          <DownloadLink />

          {/* TODO: Summary page */}
          {/* Button to summary page */}
          {/* <button className="font-bold rounded-lg p-2 text-lg text-black flex justify-center items-center h-auto w-[70%] my-1 transition-colors bg-rose-300/80 hover:bg-teal-600">
            Save your analysis{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </button> */}
        </div>
      </div>
      <div className="flex-grow relative my-5 mx-10 rounded-lg bg-slate-300">
        <div className="absolute top-0 h-[10%] flex-grow w-full p-2 rounded-t-lg bg-slate-300 ">
          <div className="grid relative">
            <label
              htmlFor="viewLabel"
              className="text-2xl font-bold place-self-center my-1"
            >
              3D view
            </label>
            <button className="font-bold absolute right-0 rounded-lg p-4 text-2xl text-black flex justify-center items-center h-10 my-1 transition-colors bg-rose-300/80 hover:bg-teal-600">
              2D view
            </button>
          </div>
        </div>

        <div className="absolute bottom-0 h-[90%] flex-grow w-full py-12 rounded-b-lg bg-slate-600">
          {/* {myData.map((data) => (
            <div key={data.id}>
              <h1>{data.id}</h1>
              <h2>{data.sequence}</h2>
              <p>{data.dot_bracket}</p>
            </div>
          ))} */}
        </div>
      </div>
    </div>
  );
};
export default Panel;
