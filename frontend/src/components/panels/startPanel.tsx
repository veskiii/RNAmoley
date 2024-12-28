import React, { useState, ChangeEvent, FormEvent, useContext } from "react";
import "../../App.css";
import RadioButtons from "../common/radioButtons";
import { NameContext } from "../../App";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@mui/material";
import { Colors } from "./colors";

function checkConditions(
  rnaFile: File | null,
  pdbCode: string,
  radiobutton: string
): boolean {
  let countConditions = 0;
  if (radiobutton !== "None") countConditions++;
  if (rnaFile) countConditions++;
  if (pdbCode) {
    if (pdbCode.length === 4) countConditions++;
  }
  if (countConditions === 1) return true;
  return false;
}

const Dashboard: React.FC = () => {
  const [jobName, setJobName] = useState<string>("");
  const [pdbCode, setPdbCode] = useState<string>("");
  const [rnaFile, setRnaFile] = useState<File | null>(null);
  const [radiobutton, setRadiobutton] = useState<string>("None");
  const context = useContext(NameContext);
  const navigate = useNavigate();


  function handle(id: string) {
    if (context) {
      const { setId } = context;
      setId(id);
      console.log("Setted jobID:", id);
      navigate("/Panel", { state: { rnaFile, pdbCode, radiobutton } });
    }
  }

  //Backend is not connected yet; errors are logged, no data is sent.
  //TODO: Check if it's working correctly on backend data
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("jobName", jobName || "");
    formData.append("pdbCode", pdbCode || "");
    if (rnaFile) formData.append("rnaFile", rnaFile);
    else formData.append("rnaFile", "");
    formData.append("radioButton", radiobutton || "None");

    formData.forEach((value, key) => {
      console.log(key, value);
    });

    const API_URL = "http://localhost:3000/api/v1/jobs";
    try {
      const response = await fetch(`${API_URL}`, {
        method: "POST",
        body: formData,
        headers: {
          //   "Content-Type": "multipart/form-data",
          "Access-Control-Allow-Origin": "http://localhost:3000",
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Job created successfully:", data.id);
        handle(data.id);
        //TODO?: change link from "/Panel" to `/Panel/${jobId}`
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
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    let files = e.target.files;
    let element = document.getElementById("fileLabel");
    if (files && files.length > 0) {
      let file = files[0];
      setRnaFile(file);
      if (element && file) {
        element.textContent = file.name;
      }
    } else {
      setRnaFile(null);
      if (element) {
        element.textContent = "No file selected";
      }
    }
  };

  const isButtonEnabled = checkConditions(rnaFile, pdbCode, radiobutton);

  return (
    <div className="flex min-h-screen flex-col items-center justify-between p-24 pt-0">
      <div className="flex flex-row text-3xl font-medium items-center self-start p-[30px]">
        <div className="flex flex-col">
          <div className="font-extrabold">
            <h1>RNA</h1>
          </div>
          <div className="font-semibold pr-5 text-{#526969}">
            <h1 style={{ color: Colors.blue }}>MOLEY</h1>
          </div>
        </div>
        {/* TODO Logo Krecik */}
        {/* <img
          src="/krecik.png"
          width={100}
          height={100}
          alt="Logo RNA Moley"
        /> */}
        <h1>| Submition panel</h1>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-row flex-wrap h-[70vh] w-[90vw] justify-around bg-slate-300 p-24 lg:rounded-xl text-teal-600 font-semibold text-lg">
          <div className="flex flex-col justify-around">
            <div>
              <label htmlFor="jobName">Job Name:</label>
              <input
                id="jobName"
                name="jobName"
                type="text"
                placeholder="Enter a job name"
                className="w-full flex justify-center p-1 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
              />
            </div>
            <div className="w-80">
              <p>Choose from file:</p>
              <label
                className="cursor-default flex justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-100/90"
                id="fileLabel"
                htmlFor="inputFile"
              >
                No file selected
              </label>
              <label
                className="cursor-pointer text-2xl text-black flex justify-center items-center h-10 mt-2 bg-rose-300/80 w-40 rounded-lg text-center transition-colors hover:bg-teal-600"
                htmlFor="inputFile"
              >
                Upload{''}
                <input
                  id="inputFile"
                  type="file"
                  accept=".pdb, .mmCIF, .cif"
                  onChange={handleFileChange}
                  hidden
                />
              </label>
            </div>

          </div>
          <div className="flex justify-around content-around align-center flex-wrap flex-col">
            <div className="w-80 mb-5">
              <label>Fetch by PDB Code:{''}
                <input
                  type="text"
                  value={pdbCode}
                  id="pdbCodeInput"
                  className="w-full flex justify-center p-1 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  onChange={(e) => setPdbCode(e.target.value)}
                  maxLength={4}
                  placeholder="Enter a PDB code"
                />
              </label>
            </div>
            <RadioButtons
              selectedValue={radiobutton}
              onValueChange={setRadiobutton}
            />


            <button
              type="submit"
              disabled={!isButtonEnabled}
              className={`${isButtonEnabled ? "" : "bg-gray-400 cursor-not-allowed"
                } transition-colors`}
            >
              <h2 className="text-2xl text-black">
                Run{" "}
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                  ⮕
                </span>
              </h2>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Dashboard;
