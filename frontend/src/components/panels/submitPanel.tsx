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
import HelpIcon from "../common/helpIcon";
import Logo from "../common/logo";
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

  const samples = [
    { id: "good", value: "good", label: "good" },
    { id: "medium", value: "medium", label: "medium" },
    { id: "bad", value: "bad", label: "bad" },
  ];

  const getSelectedJobName = () => {
    if (rnaFile) {
      return rnaFile.name;
    }

    if (radiobutton !== "None") {
      return `Example (${radiobutton})`;
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
    } else {
      setPdbCode("");
      setRadiobutton("None");

      setRnaFile(newValue);
    }
  }

  return (
    <div className="desktop-content w-full h-full" style={{ color: "black" }}>
      <div className="flex flex-row pt-2 pl-[10vw] gap-8">
        <Logo />
        {/* <HomeIcon /> */}
        <HelpIcon />
      </div>
      <div className="flex flex-col items-center px-[10vw] pt-6">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-row">
            <div className="space-y-12">
              <h2 className="text-base/7 font-semibold text-gray-900">
                Upload RNA 3D structure in the PDB/mmCIF file
              </h2>

              <div className="border-b border-gray-900/10 pb-6">
                <label
                  htmlFor="examples"
                  className="block text-sm/6 font-medium text-gray-900"
                >
                  from example
                </label>

                <div
                  id="examples"
                  className="inline-flex rounded-md shadow-xs mt-2"
                  role="group"
                >
                  <button
                    type="button"
                    onClick={() => customSetState("example", samples[0].value)}
                    className={`px-4 py-2 mt-0 text-sm font-medium  bg-white border border-gray-200 rounded-s-lg hover:bg-gray-100 hover:text-moley-blue ${
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
                    className={`px-4 py-2 mt-0 text-sm font-medium  bg-white border border-gray-200 rounded-s-lg hover:bg-gray-100 hover:text-moley-blue ${
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
                    className={`px-4 py-2 mt-0 text-sm font-medium  bg-white border border-gray-200 rounded-s-lg hover:bg-gray-100 hover:text-moley-blue ${
                      radiobutton == samples[2].value
                        ? "z-10 ring-2 ring-moley-blue text-moley-blue"
                        : "text-gray-900 ring-0 z-0"
                    }`}
                  >
                    {samples[2].label}
                  </button>
                </div>
              </div>

              <div className="border-b border-gray-900/10 pb-6">
                <label
                  htmlFor="pdbCodeInput"
                  className="block text-sm/6 font-medium text-gray-900"
                >
                  from Protein Data Bank
                </label>
                <div className="mt-2">
                  <input
                    id="pdbCodeInput"
                    type="text"
                    value={pdbCode}
                    onChange={(e) => customSetState("pdbCode", e.target.value)}
                    pattern="[A-Za-z0-9]{4}"
                    placeholder="Enter PDB ID"
                    className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 border border-gray-300 placeholder:text-gray-400 focus:border-moley-blue focus:ring-1 focus:ring-moley-blue sm:text-sm"
                  />
                </div>
              </div>

              <div className="border-b border-gray-900/10 pb-6">
                <div className="col-span-full">
                  <label
                    htmlFor="cover-photo"
                    className="block text-sm/6 font-medium text-gray-900"
                  >
                    from local repository
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
            </div>
            <div className="flex flex-col justify-center items-center p-5 text-center">
              <div>
                <div className="font-bold">Welcome to RNAmoley!</div>
                <div>
                  The webserver analyzes RNA 3D structures to assess their
                  quality by examining structural elements. You can upload
                  PDB/mmCIF files, fetch data by PDB ID or use pre-selected
                  samples.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-x-6">
            <button
              type="submit"
              className="rounded-md px-3 py-2 bg-moley-darkGreen text-sm font-semibold text-white shadow-xs hover:bg-moley-green focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors"
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
                "Run"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Dashboard;
