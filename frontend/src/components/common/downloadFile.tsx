import React from "react";
import {Colors} from "./colors";

type DownloadButtonProps = {
    id?: string; // Definiujemy, że id musi być stringiem
};

const DownloadButton: React.FC<DownloadButtonProps> = ({ id }) => {
    const handleDownload = async () => {
        try {
            const response = await fetch(`http://rnamoley.cs.put.poznan.pl/api/v1/jobs/${id}/download`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(`Download error! status: ${response.status}`);
            }

            let downloadButton = document.getElementById("downloadButton") as HTMLElement;
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
        } catch (error) {
            console.error("Download failed:", error);
        }
    };

    return (
        <button
            id = "downloadButton"
            onClick={handleDownload}
            className={
                "font-bold rounded-lg p-2 text-lg text-black flex justify-center items-center h-auto w-[90%] my-1"
            }
        >
            Download result files
        </button>
    );
};

export default DownloadButton;