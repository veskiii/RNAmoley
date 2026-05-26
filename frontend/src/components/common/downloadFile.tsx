import React from "react";
import { Colors } from "./colors";
import { API_URL } from "../../App";
import JSZip from "jszip";

type DownloadButtonProps = {
  id?: string; // Definiujemy, że id musi być stringiem
  jobName?: string;
  disabled: boolean;
  getAdditionalFiles?: () => Promise<Array<{ path: string; blob: Blob }>>;
};

const formatZipTimestamp = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}${month}${day}${hour}${minute}`;
};

const sanitizeFilenamePart = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/-+/g, "-");

const buildDownloadFilename = (jobName?: string) => {
  const safeJobName = sanitizeFilenamePart(jobName || "job") || "job";
  const timestamp = formatZipTimestamp(new Date());
  return `RNAmoley-results-${safeJobName}-${timestamp}.zip`;
};

const DownloadButton: React.FC<DownloadButtonProps> = ({ id, jobName, disabled, getAdditionalFiles }) => {
  const handleDownload = async () => {
    try {
      const response = await fetch(`${API_URL}/jobs/${id}/download`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Download error! status: ${response.status}`);
      }
      const downloadFilename = buildDownloadFilename(jobName);

      let downloadButton = document.getElementById(
        "downloadButton"
      ) as HTMLElement;
      downloadButton.textContent = "✔ Files downloaded!";
      downloadButton.style.color = "#000000";
      downloadButton.style.backgroundColor = Colors.beige;

      const backendZipBlob = await response.blob();
      let zipBlobToDownload = backendZipBlob;

      if (getAdditionalFiles) {
        const additionalFiles = await getAdditionalFiles();
        if (additionalFiles.length > 0) {
          const zip = await JSZip.loadAsync(backendZipBlob);
          additionalFiles.forEach((file) => {
            zip.file(file.path, file.blob);
          });
          zipBlobToDownload = await zip.generateAsync({ type: "blob" });
        }
      }

      const url = window.URL.createObjectURL(zipBlobToDownload);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setTimeout(() => {
        downloadButton.textContent = "Download results";
        downloadButton.style.color = "#ffffff";
        downloadButton.style.backgroundColor = Colors.moleyDarkGreen;
      }, 2000);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  return (
    <button
      id="downloadButton"
      onClick={handleDownload}
      disabled={disabled}
      className="rounded-md mt-0 h-auto px-2 py-2 bg-moley-darkGreen text-sm/6 font-semibold text-white shadow-xs hover:bg-moley-green focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
      title="Download all analysis results for the structure as a ZIP file."
    >
      Download results
    </button>
  );
};

export default DownloadButton;
