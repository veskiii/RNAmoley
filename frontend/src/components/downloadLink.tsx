import React from "react";
import { Colors } from "./colors"

const DownloadLink = () => {
  const content = window.location.href;
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      let saveButton = document.getElementById("saveButton") as HTMLElement;
      saveButton.textContent = "✔ Link copied!";
      saveButton.style.backgroundColor = Colors.beige;
    } catch (error) {
      console.error("Unable to copy to clipboard:", error);
    }
  };

  return (
    <button
      id="saveButton"
      onClick={handleCopy}
      className={
        "font-bold rounded-lg p-2 text-lg text-black flex justify-center items-center h-auto w-[90%] my-1 transition-colors hover:bg-sky-400"
      }
      style={{backgroundColor: Colors.salmon}}
    >
      TODO: Analyze
    </button>
  );
};

export default DownloadLink;
