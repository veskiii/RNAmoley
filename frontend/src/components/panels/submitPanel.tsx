import React, {
  useState,
  useRef,
  ChangeEvent,
  FormEvent,
  useContext,
} from "react";
import "../../App.css";
import { NameContext } from "../../App";
import { useNavigate } from "react-router-dom";
import HomeIcon from "../common/homeIcon";
import Logo from "../common/logo";
import Footer from "../common/footerComponent";
import { createJob, fetchJobCreation } from "../utils/api";
import { isFileValid } from "../utils/fileValidation";

const Dashboard: React.FC = () => {
  const [pdbCode, setPdbCode] = useState<string>("");
  const [rnaFile, setRnaFile] = useState<File | null>(null);
  const [radiobutton, setRadiobutton] = useState<string>("None");
  const context = useContext(NameContext);
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [useWalkingSphere, setUseWalkingSphere] = useState(true);
  const [sphereRadius, setSphereRadius] = useState<number>(5);
  const [sphereInterval, setSphereInterval] = useState<number>(1);

  type SamplePreset = {
    id: string;
    value: string;
    label: string;
    file: string;
    useWalkingSphere: boolean;
    sphereRadius: number;
    sphereInterval: number;
  };

  const samples: SamplePreset[] = [
    {
      id: "good",
      value: "Example 1",
      label: "1",
      file: "Xiao model 04 submitted to PZ39",
      useWalkingSphere: true,
      sphereRadius: 15,
      sphereInterval: 5,
    },
    {
      id: "medium",
      value: "Example 2",
      label: "2",
      file: "RNAComposer model 03 submitted to PZ39",
      useWalkingSphere: true,
      sphereRadius: 5,
      sphereInterval: 1,
    },
    {
      id: "medium2",
      value: "Example 3",
      label: "3",
      file: "RNAComposer model 03 submitted to PZ39",
      useWalkingSphere: true,
      sphereRadius: 5,
      sphereInterval: 1,
    },
    {
      id: "bad",
      value: "Example 4",
      label: "4",
      file: "Dfold model 01 submitted to PZ39",
      useWalkingSphere: true,
      sphereRadius: 5,
      sphereInterval: 1,
    },
    {
      id: "bad2",
      value: "Example 5",
      label: "5",
      file: "Dfold model 01 submitted to PZ39",
      useWalkingSphere: true,
      sphereRadius: 8,
      sphereInterval: 2,
    },
  ];

  const getSelectedJobName = () => {
    if (rnaFile) {
      return rnaFile.name;
    }

    if (radiobutton !== "None") {
      return `${radiobutton}`;
    }

    return pdbCode.trim();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("jobName", getSelectedJobName());
    formData.append("pdbCode", pdbCode || "");
    formData.append("rnaFile", rnaFile || "");
    formData.append("radioButton", radiobutton || "None");
    formData.append("useWalkingSphere", useWalkingSphere.toString());
    formData.append("sphereRadius", sphereRadius.toString());
    formData.append("sphereInterval", sphereInterval.toString());
    try {
      const response = await createJob(formData);
      if (response && response.id) {
        if (context) context.setId(response.id);
        // Polling status
        const pollInterval = 2000;
        let attempts = 0;
        const maxAttempts = 60; // max 2 min
        const checkStatus = async () => {
          try {
            // Zakładam, że istnieje funkcja getJobStatus(jobId)
            const statusResp = await fetchJobCreation(response.id);
            if (statusResp.metadata.status === "created") {
              navigate(`/analysisPanel/${response.id}`);
            } else if (statusResp.metadata.status === "failed") {
              setIsSubmitting(false);
              console.error(statusResp.metadata.error_message);
              alert("Job creation failed.");
            } else if (attempts < maxAttempts) {
              attempts++;
              setTimeout(checkStatus, pollInterval);
            } else {
              setIsSubmitting(false);
              alert("Job timeout. Try again later.");
            }
          } catch (err: any) {
            setIsSubmitting(false);
            alert(`Failed to check job status\n${err.message}`);
          }
        };
        checkStatus();
      } else {
        setIsSubmitting(false);
        alert("No job ID returned.");
      }
    } catch (error: any) {
      setIsSubmitting(false);
      alert(`Failed to create job\n${error.message}`);
    }
  };

  const handleFileInput = (file: File | null) => {
    let fileLabel = document.getElementById("fileLabel");
    if (file && isFileValid(file.name)) {
      customSetState("rnaFile", file);
      if (fileLabel) {
        fileLabel.style.color = "";
        fileLabel.textContent = file.name;
      }
    } else {
      setRnaFile(null);
      if (fileLabel) {
        fileLabel.style.color = "red";
        fileLabel.textContent = "Invalid file type";
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0] || null;
    handleFileInput(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    handleFileInput(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const clearFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  function customSetState(field: string, newValue: any | null) {
    if (field === "pdbCode") {
      clearFileInput();
      setRnaFile(null);
      setRadiobutton("None");

      setPdbCode(newValue);
    } else if (field === "example") {
      clearFileInput();
      setRnaFile(null);
      setPdbCode("");

      setRadiobutton(newValue);
      const selectedSample = samples.find(sample => sample.value === newValue);
      if (selectedSample) {
        setUseWalkingSphere(selectedSample.useWalkingSphere);
        setSphereRadius(selectedSample.sphereRadius);
        setSphereInterval(selectedSample.sphereInterval);
      }
    } else {
      setPdbCode("");
      setRadiobutton("None");

      setRnaFile(newValue);
    }
  }

  function resetSettings() {
    setUseWalkingSphere(true);
    setSphereRadius(5);
    setSphereInterval(1);
    clearFileInput();
    setPdbCode("");
    setRadiobutton("None");
  }

  const isFormFilled = () => {
    return (pdbCode.trim() !== "" || rnaFile !== null || radiobutton !== "None");
  };

  return (
    <div className="desktop-content min-h-screen w-full flex flex-col" style={{ color: "black" }}>
      <div className="sticky top-0 bg-white flex flex-row gap-2 pt-2 justify-between pr-10 pb-2 shadow-bottom z-20">
        <Logo />
        <HomeIcon />
      </div>
      <div className="flex flex-1 flex-col items-center px-[10vw] pt-12">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-row">
            <div className="space-y-3">
            <div className="flex flex-col justify-center items-start text-left">
              <div>
                <div>
                  Welcome to RNAmoley, a web server for detailed analysis of RNA 3D 
                  models (PDB/mmCIF), enabling local detection and refinement of 
                  geometric and stereochemical errors. 
                </div>
              </div>
            </div>
              <h2 className="text-base/7 font-bold text-gray-900">
                Input RNA 3D structure
              </h2>

              <div className="">
                <div className="col-span-full">
                  <label
                    htmlFor="cover-photo"
                    className="block text-sm/6 font-medium text-gray-900"
                  >
                    Upload a PDB/mmCIF file (single or multiple models)
                  </label>
                  <div
                    className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                  >
                    <div className="text-center">
                      {rnaFile && (
                        <div className="text-sm text-gray-700">
                          Selected file:{" "}
                          <span className="font-semibold">{rnaFile.name}</span>
                        </div>
                      )}
                      <div className="mt-4 flex text-sm/6 text-gray-600">
                        <label
                          htmlFor="file-upload"
                          className="relative cursor-pointer rounded-md bg-white font-semibold text-moley-blue focus-within:ring-2 focus-within:ring-moley-blue focus-within:ring-offset-2 focus-within:outline-hidden hover:text-moley-lightBlue"
                        >
                          <span>Upload a file</span>
                          <input
                            ref={fileInputRef}
                            id="file-upload"
                            name="file-upload"
                            type="file"
                            accept=".pdb, .mmCIF, .cif"
                            onChange={handleFileChange}
                            className="sr-only"
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs/5 text-gray-600">PDB, mmCIF</p>
                    </div>
                  </div>
                </div>
              </div>
              <div >
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="pdbCodeInput"
                    className="block text-sm/6 font-medium text-gray-900"
                  >
                    Fetch a structure from Protein Data Bank
                  </label>
                  <span className="group relative inline-flex cursor-help items-center justify-center">
                    <span
                      aria-label="What this field does"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                    >
                      ?
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                      Enter a single PDB ID. Provide either a 4-character or 12-character identifier.
                    </span>
                  </span>
                </div>
                <div className="mt-2">
                  <input
                    id="pdbCodeInput"
                    type="text"
                    value={pdbCode}
                    onChange={(e) => customSetState("pdbCode", e.target.value)}
                    pattern="[A-Za-z0-9]{4}|pdb_[A-Za-z0-9]{8}"
                    placeholder="Enter PDB ID"
                    className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 border border-gray-300 placeholder:text-gray-400 focus:border-moley-blue focus:ring-1 focus:ring-moley-blue sm:text-sm"
                  />
                </div>
              </div>
              <div className=" pb-6">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="examples"
                    className="block text-sm/6 font-medium text-gray-900"
                  >
                    Select from ready-to-use examples
                  </label>
                <span className="group relative inline-flex cursor-help items-center justify-center">
                    <span
                      aria-label="What this field does"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                    >
                      ?
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                      Select one of five preloaded example structures from RNA-Puzzles submissions.
                    </span>
                  </span>
                </div>

                <div
                  id="examples"
                  className="inline-flex rounded-md shadow-xs mt-2"
                  role="group"
                >
                  <button
                    type="button"
                    onClick={() => customSetState("example", samples[0].value)}
                    title={samples[0].file}
                    className={`w-12 mx-1 px-4 py-2 mt-0 text-sm font-medium  bg-white border border-gray-200 rounded-s-lg hover:bg-gray-100 hover:text-moley-blue ${
                      radiobutton == samples[0].value
                        ? "z-10 ring-2 ring-moley-blue text-moley-blue"
                        : "text-gray-900 ring-0 z-0"
                    }`}
                  >
                    {samples[0].label}
                  </button>
                  <button
                    type="button"
                    onClick={() => customSetState("example", samples[1].value)}
                    title={samples[1].file}
                    className={`w-12 mx-1 px-4 py-2 mt-0 text-sm font-medium  bg-white border border-gray-200 rounded-s-lg hover:bg-gray-100 hover:text-moley-blue ${
                      radiobutton == samples[1].value
                        ? "z-10 ring-2 ring-moley-blue text-moley-blue"
                        : "text-gray-900 ring-0 z-0"
                    }`}
                  >
                    {samples[1].label}
                  </button>
                  <button
                    type="button"
                    onClick={() => customSetState("example", samples[2].value)}
                    title={samples[2].file}
                    className={`w-12 mx-1 px-4 py-2 mt-0 text-sm font-medium  bg-white border border-gray-200 rounded-s-lg hover:bg-gray-100 hover:text-moley-blue ${
                      radiobutton == samples[2].value
                        ? "z-10 ring-2 ring-moley-blue text-moley-blue"
                        : "text-gray-900 ring-0 z-0"
                    }`}
                  >
                    {samples[2].label}
                  </button>
                  <button
                    type="button"
                    onClick={() => customSetState("example", samples[3].value)}
                    title={samples[3].file}
                    className={`w-12 mx-1 px-4 py-2 mt-0 text-sm font-medium  bg-white border border-gray-200 rounded-s-lg hover:bg-gray-100 hover:text-moley-blue ${
                      radiobutton == samples[3].value
                        ? "z-10 ring-2 ring-moley-blue text-moley-blue"
                        : "text-gray-900 ring-0 z-0"
                    }`}
                  >
                    {samples[3].label}
                  </button>
                  <button
                    type="button"
                    onClick={() => customSetState("example", samples[4].value)}
                    title={samples[4].file}
                    className={`w-12 mx-1 px-4 py-2 mt-0 text-sm font-medium  bg-white border border-gray-200 rounded-s-lg hover:bg-gray-100 hover:text-moley-blue ${
                      radiobutton == samples[4].value
                        ? "z-10 ring-2 ring-moley-blue text-moley-blue"
                        : "text-gray-900 ring-0 z-0"
                    }`}
                  >
                    {samples[4].label}
                  </button>
                </div>
              </div>
              
            </div>
          </div>

          <div className="mt-6 text-base/7"><strong>Local analysis settings</strong></div>
          <div>
          <div className="flex items-center gap-2 py-4">
            <div className="flex items-center gap-2">
              <label htmlFor="sequential-toggle" className="font-semibold text-sm/6">
                Enable local analysis
              </label>
              <span className="group relative inline-flex cursor-help items-center justify-center">
                    <span
                      aria-label="What this field does"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                    >
                      ?
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                      Apply spatial neighborhood analysis to identify local structural irregularities.
                    </span>
                  </span>
                </div>
            <input
              id="sequential-toggle"
              type="checkbox"
              checked={useWalkingSphere}
              onChange={e => setUseWalkingSphere(e.target.checked)}
              className="w-5 h-5 accent-moley-accentGreen"
            />
            </div>
            {(
              <div className="mb-4 py-2 bg-white rounded text-sm/6">
                <div className="mb-2 flex flex-row items-center">
                  <div className="flex items-center gap-2">
                    <label className="block text-sm font-medium">Sphere radius (Å):</label>
                    <span className="group relative inline-flex cursor-help items-center justify-center">
                    <span
                      aria-label="What this field does"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                    >
                      ?
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                      Defines the radius of the local neighborhood centered at each C1′ atom.
                    </span>
                  </span>
                </div>
                  <input
                    type="number"
                    min={1}
                    value={sphereRadius}
                    disabled={!useWalkingSphere}
                    onChange={e => setSphereRadius(parseInt(e.target.value))}
                    className="border rounded px-2 py-1 mx-2"
                  />
                </div>
                <div className="flex flex-row items-center">
                  <div className="flex items-center gap-2">
                  <label className="block text-sm font-medium">Sampling interval:</label>
                  <span className="group relative inline-flex cursor-help items-center justify-center">
                    <span
                      aria-label="What this field does"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 text-xs font-semibold text-gray-600"
                    >
                      ?
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                      Defines how frequently local neighborhoods are sampled along the chain. Neighborhoods are centered at C1′ atoms: 1 = every nucleotide, 2 = every second nucleotide, etc.
                    </span>
                  </span>
                </div>
                  <input
                    type="number"
                    min={1}
                    value={sphereInterval}
                    disabled={!useWalkingSphere}
                    onChange={e => setSphereInterval(parseInt(e.target.value))}
                    className="border rounded px-2 py-1 mx-2"
                  />
                </div>
              </div>
              )}</div>

          <div className="my-6 flex items-center justify-start gap-x-6">
            <button
              type="submit"
              disabled={isFormFilled() ? false : true || isSubmitting}
              className="rounded-md px-3 py-2 bg-moley-darkGreen text-sm font-semibold text-white shadow-xs hover:bg-moley-green focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                  Loading{" "}
                  <div role="status">
                    <svg
                      aria-hidden="true"
                      className="ml-2 w-4 h-4 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
                      viewBox="0 0 100 101"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                        fill="currentColor"
                      />
                      <path
                        d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                        fill="currentFill"
                      />
                    </svg>
                  </div>
                </span>
              ) : (
                "Next"
              )}
            </button>
            <button 
            type="button"
            className="rounded-md px-3 py-2 bg-gray-500 text-sm font-semibold text-white shadow-xs hover:bg-gray-400 focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors "
            onClick={resetSettings}>
              Reset settings
            </button>
          </div>
        </form>
      </div>
      <Footer />
    </div>
  );
};

export default Dashboard;
