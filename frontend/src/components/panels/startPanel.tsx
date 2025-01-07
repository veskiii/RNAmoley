import React, { useState, ChangeEvent, FormEvent, useContext } from "react";
import "../../App.css";
import RadioButtons from "../common/radioButtons";
import { NameContext } from "../../App";
import { useNavigate } from "react-router-dom";
import { Colors } from "../common/colors";

export function isInputValid(
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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isUploadedFile, setIsUploadedFile] = useState<boolean>(false);
  const [selectedInputType, setSelectedInputType] = useState<string>("none");

  const options = [
    {id: "file", value: "file", label: "Upload file"},
    {id: "PDBid", value: "PDBid", label: "Fetch by PDB id"},
    {id: "sample", value: "sample", label: "Choose from samples"},
  ];

  const samples = [
    {id: "good", value: "good", label: "good"},
    {id: "medium", value: "medium", label: "medium"},
    {id: "bad", value: "bad", label: "bad"},
  ];

  function handle(id: string) {
    if (context) {
      const { setId } = context;
      setId(id);
      console.log("Setted jobID:", id);
      navigate("/Panel", { state: { rnaFile, pdbCode, radiobutton } });
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
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
          "Access-Control-Allow-Origin": "http://localhost:3000",
        }
      });

      if (response.ok) {
        setIsSubmitting(false);
        const data = await response.json();
        console.log("Job created successfully:", data.id);
        handle(data.id);
      } else {
        setIsSubmitting(false);
        let errorData = await response.json();
        console.error("Error creating job:", errorData);
        const errorMessage = errorData?.message || "Unknown error";
        alert("Failed to create job: " + errorMessage);
      }
    } catch (error) {
      setIsSubmitting(false);
      console.error(error);
      alert("Failed to create job");
    }
  };
  const removeFile = () =>{
    setRnaFile(null);
    setIsUploadedFile(false);
    let element = document.getElementById("fileLabel");
    if (element) {
      element.style.color = "";
      element.textContent = "No file selected";
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    let files = e.target.files;
    let element = document.getElementById("fileLabel");
    if (files && files.length > 0) {
      let file = files[0];
      const validExtensions = [".pdb", ".mmCIF", ".cif"];
      const fileExtension = file.name.slice(file.name.lastIndexOf('.'));
      if(validExtensions.includes(fileExtension)){
        setRnaFile(file);
        setIsUploadedFile(true);
        if (element && file) {
          element.style.color = "";
          element.textContent = file.name;
        }
      }else{
        setRnaFile(null);
        setIsUploadedFile(false);
        if (element) {
          element.style.color = "red"
          element.textContent = "Invalid file type";
        }
      }

    } else {
      setRnaFile(null);
      setIsUploadedFile(false);
      if (element) {
        element.style.color = "";
        element.textContent = "No file selected";
      }
    }
  };

  const isButtonEnabled = isInputValid(rnaFile, pdbCode, radiobutton);

  return (
    <div className="flex min-h-screen flex-col items-center justify-between py-24 px-[10vw] pt-0">
      <div className="flex flex-row text-3xl font-medium items-center self-start mt-4">
        <div className="flex flex-col">
          <div className="font-extrabold">
            <h1>RNA</h1>
          </div>
          <div className="font-semibold text-teal-600 ">
            <h1>MOLEY</h1>
          </div>
        </div>
        <h1 className="pl-2">| Submition panel</h1>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-4 items-start content-center justify-items-center h-[70vh] w-[80vw] bg-slate-300 p-24 lg:rounded-xl text-teal-600 font-semibold text-lg">
          <div className="flex flex-col ">
            <div>
              <label htmlFor="jobName">Name of task:</label>
              <input
                id="jobName"
                name="jobName"
                type="text"
                placeholder="Enter task name"
                className="w-full flex justify-center p-1 mb-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
              />
            </div>
            {selectedInputType === "none" && (
                <div >
                <p>Choose from samples:</p>
                <RadioButtons
                  options={options}
                  selectedValue={selectedInputType}
                  onValueChange={setSelectedInputType}
                />
              </div>
            )}
            {selectedInputType === "PDBid" && (
              <div>
                <label>Fetch by PDB Code:{''}
                <input
                  type="text"
                  value={pdbCode}
                  id="pdbCodeInput"
                  className="w-full flex justify-center p-1 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  onChange={(e) => setPdbCode(e.target.value)}
                  maxLength={4}
                  pattern="[A-Za-z0-9]{4}"
                  placeholder="Enter a PDB code"
                />
              </label>
              </div>
            )}
            {selectedInputType === "file" && (
              <div className="w-80">
              <p>Choose from file:</p>
              <label
                className="cursor-default flex justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-100/90"
                id="fileLabel"
                htmlFor="inputFile"
              >
                No file selected
              </label>
              {isUploadedFile===false && (
                  <label
                  className="cursor-pointer text-2xl text-black flex justify-center items-center h-10 mt-2 bg-rose-300 w-40 rounded-lg text-center transition-colors hover:bg-teal-600"
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
                )}
                {isUploadedFile && (
                  <label
                  className="cursor-pointer text-2xl text-black flex justify-center items-center h-10 mt-2 bg-rose-300 w-40 rounded-lg text-center transition-colors hover:bg-teal-600"
                  htmlFor="inputFile"
                  onClick={removeFile}
                >
                  Remove{''}
                </label>
                )}

              </div>
            )}
            {selectedInputType === "sample" && (
              <div>
                <p>Choose a sample to analyze (quality-based):</p>
                <RadioButtons
                  options={samples}
                  selectedValue={radiobutton}
                  onValueChange={setRadiobutton}
                />
              </div>
            )}

          </div>
          <div className="flex justify-center content-around align-center flex-wrap flex-col">
            <button
              type="submit"
              disabled={!isButtonEnabled || isSubmitting}
              className={`${isButtonEnabled ? "" : "bg-gray-400 cursor-not-allowed"
                } transition-colors`}
            >
            {isSubmitting===false && (
              <h2 className="text-2xl text-black">
                {" Run >"}
              </h2>
            )}
            {isSubmitting &&(
                <h2 className="text-2xl text-black">
                Loading{" "}
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">

                  <div role="status">
                      <svg aria-hidden="true" className="w-4 h-4 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/>
                          <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill"/>
                      </svg>
                      <span className="sr-only">Loading...</span>
                  </div>

                </span>
              </h2>
             )}

            </button>
            {selectedInputType !== "none" && (
              <button
              onClick={()=>{setSelectedInputType("none"); setRnaFile(null); setPdbCode(""); setRadiobutton("None")}}
              className="w-auto px-4"
              >
                {'< Back'}
              </button>
            )}

          </div>
        </div>
      </form>
    </div>
  );
};

export default Dashboard;
