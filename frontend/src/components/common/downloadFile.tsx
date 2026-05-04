import React from "react";
import { Colors } from "./colors";
import { API_URL } from "../../App";

type DownloadButtonProps = {
  id?: string; // Definiujemy, że id musi być stringiem
  disabled: boolean;
};

const DownloadButton: React.FC<DownloadButtonProps> = ({ id, disabled }) => {
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

      let downloadButton = document.getElementById(
        "downloadButton"
      ) as HTMLElement;
      downloadButton.textContent = "✔ Files downloaded!";
      downloadButton.style.color = "#000000";
      downloadButton.style.backgroundColor = Colors.beige;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${id}.zip`;
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
