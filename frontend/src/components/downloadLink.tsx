import React from "react";

const DownloadLink = () => {
  const content = window.location.href;
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      console.log("Copied to clipboard:", content);
    } catch (error) {
      console.error("Unable to copy to clipboard:", error);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={
        "font-bold rounded-lg p-2 text-lg text-black flex justify-center items-center h-auto w-[90%] my-1 transition-colors bg-rose-300/80 hover:bg-teal-600"
      }
    >
      Download link to workspace
    </button>
  );
};

export default DownloadLink;
