import React from "react";
import { Colors } from "./colors"

const DownloadLink = () => {
  const content = window.location.href;
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      let saveButton = document.getElementById("saveButton") as HTMLElement;
      saveButton.textContent = "✔ Link copied!";
      saveButton.style.color = "#000000";
      saveButton.style.backgroundColor = Colors.beige;
      setTimeout(() => {
        saveButton.textContent = "Copy link";
        saveButton.style.color = "#FFFFFF";
        saveButton.style.backgroundColor = Colors.moleyDarkGreen;
      }, 2000);
    } catch (error) {
      console.error("Unable to copy to clipboard:", error);
    }
  };

  return (
    <button
      id="saveButton"
      onClick={handleCopy}
      className="rounded-md mt-0 h-auto  px-2 py-2 bg-moley-darkGreen text-sm/6 font-semibold text-white shadow-xs hover:bg-moley-green focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
      title="Copy a link to the current results page (valid for 14 days)."
    >
      Copy link
    </button>
  );
};

export default DownloadLink;
